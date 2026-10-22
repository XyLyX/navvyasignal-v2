import copy
import datetime as dt
import json
import unittest
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch
from pipeline import desk_discovery as d
from pipeline import editorial_selection as selection
from pipeline import main as editor
from pipeline import regional_release as release

NOW = dt.datetime.fromisoformat('2026-10-22T13:00:00+00:00')


def candidate():
    return {'title':'New regional development', 'development':'A new consequential event occurred.',
            'event_at':'2026-10-22T11:00:00+00:00', 'theme':'Security',
            'sources':[{'url':'https://example.com/news/story','publisher':'Example',
                        'published_at':'2026-10-22T12:00:00+00:00'}]}


def response(data, searched=True):
    blocks = [NS(type='text',text=json.dumps(data))]
    if searched:
        blocks.extend([NS(type='server_tool_use',name='web_search',input={'query':'regional news site:reuters.com'}),
                       NS(type='web_search_tool_result',content=[NS(url='https://example.com/news/story')])])
    return NS(content=blocks)


def stream(value):
    context=Mock();context.__enter__=Mock(return_value=Mock(get_final_message=Mock(return_value=value)))
    context.__exit__=Mock(return_value=False)
    return context


class DiscoveryTests(unittest.TestCase):
    def test_rss_imports_only_recent_allowlisted_metadata(self):
        raw=b'''<rss><channel><item><title>Current headline</title><link>https://www.bbc.com/news/current</link><pubDate>Thu, 22 Oct 2026 12:00:00 GMT</pubDate><description>Do not import this article prose</description></item><item><title>Old</title><link>https://www.bbc.com/news/old</link><pubDate>Tue, 20 Oct 2026 01:00:00 GMT</pubDate></item><item><title>Foreign link</title><link>https://untrusted.example/news</link><pubDate>Thu, 22 Oct 2026 12:00:00 GMT</pubDate></item></channel></rss>'''
        resp=Mock(status_code=200);resp.iter_content.return_value=[raw]
        context=Mock();context.__enter__=Mock(return_value=resp);context.__exit__=Mock(return_value=False)
        with patch.object(d.requests,'get',return_value=context) as get:
            leads=d.feed_leads('uae_middle_east',NOW)
        self.assertEqual(len(leads),1);self.assertTrue(leads[0]['lead_only'])
        self.assertNotIn('article prose',json.dumps(leads));self.assertFalse(get.call_args.kwargs['allow_redirects'])

    def test_rss_rejects_entities_and_oversized_documents(self):
        for raw in [b'<!DOCTYPE rss [<!ENTITY x SYSTEM "file:///etc/passwd">]><rss/>',b'x'*512001]:
            resp=Mock(status_code=200);resp.iter_content.return_value=[raw]
            context=Mock();context.__enter__=Mock(return_value=resp);context.__exit__=Mock(return_value=False)
            with patch.object(d.requests,'get',return_value=context),self.assertRaises(ValueError):
                d.feed_leads('europe',NOW)

    def test_old_event_not_freshened_by_new_liveblog(self):
        row=candidate();row['event_at']='2026-03-24'
        with self.assertRaisesRegex(ValueError,'48h'):d.validate_candidate(row,NOW)

    def test_old_source_cannot_prove_new_event(self):
        row=candidate();row['sources'][0]['published_at']='2026-10-18'
        with self.assertRaisesRegex(ValueError,'48h'):d.validate_candidate(row,NOW)

    def test_date_only_and_timezone_are_not_fabricated(self):
        row=candidate();row['event_at']='2026-10-21'
        self.assertEqual(d.validate_candidate(row,NOW)['freshness'],'date_only_recent')
        for date in ['2026-10-23','2026-10-20','2026-10-22T12:00:00']:
            with self.assertRaises(ValueError):d.fresh_date(date,NOW)

    def test_older_48h_development_requires_reason(self):
        row=candidate();row['event_at']='2026-10-20T15:00:00Z'
        with self.assertRaisesRegex(ValueError,'explanation'):d.validate_candidate(row,NOW)
        row['still_current_reason']='Material disruption continues with current official confirmation'
        self.assertEqual(d.validate_candidate(row,NOW)['freshness'],'24_48h')

    def test_every_desk_runs_all_theme_passes_with_observed_search(self):
        for key in d.SOURCES:
            with self.subTest(desk=key):
                payload={'candidates':[candidate()], 'source_checks':[
                    {'domain':s,'status':'not_checked','reason':'No access in this bounded pass'} for s in d.SOURCES[key]], 'limitations':[]}
                e=Mock(GROUPS=editor.GROUPS)
                replies=[response(payload) for _ in d.PASSES]
                for i,reply in enumerate(replies):
                    reply.content[1].input={'query':'latest site:'+d.SOURCES[key][i]}
                e.client.messages.stream.side_effect=[stream(reply) for reply in replies]
                with patch.object(d,'feed_leads',return_value=[]):audit=d.discover(e,key,NOW)
                self.assertEqual([p['name'] for p in audit['passes']],list(d.PASSES))
                self.assertEqual(len(audit['candidates']),3)
                self.assertTrue(all(p['queries'] and p['result_urls'] for p in audit['passes']))
                self.assertEqual(e.client.messages.stream.call_count,3)

    def test_claiming_search_without_actual_search_fails(self):
        e=Mock(GROUPS=editor.GROUPS);e.client.messages.stream.return_value=stream(response({},False))
        with patch.object(d,'feed_leads',return_value=[]),self.assertRaisesRegex(ValueError,'observed live'):
            d.discover(e,'uae_middle_east',NOW)

    def test_generic_search_alone_cannot_claim_source_checklist(self):
        result=response({})
        result.content[1].input={'query':'latest news'}
        e=Mock(GROUPS=editor.GROUPS);e.client.messages.stream.return_value=stream(result)
        with patch.object(d,'feed_leads',return_value=[]),self.assertRaisesRegex(ValueError,'targeted source'):
            d.discover(e,'europe',NOW)

    def test_feed_failure_is_visible_and_does_not_disable_search(self):
        e=Mock(GROUPS=editor.GROUPS)
        data={'candidates':[], 'source_checks':[{'domain':s,'status':'no_current_result','reason':'No dated story found'} for s in d.SOURCES['europe']]}
        replies=[response(data) for _ in d.PASSES]
        for i,reply in enumerate(replies):
            reply.content[1].input={'query':'latest site:'+d.SOURCES['europe'][i]}
        e.client.messages.stream.side_effect=[stream(reply) for reply in replies]
        with patch.object(d,'feed_leads',side_effect=ValueError()):audit=d.discover(e,'europe',NOW)
        self.assertEqual(audit['feed_status'],'unavailable');self.assertTrue(audit['limitations'])

    def test_every_candidate_requires_a_decision_and_matching_draft(self):
        audit={'candidates':[dict(candidate(),candidate_id='a'),dict(candidate(),candidate_id='b')]}
        data={'notion_entries':[{'candidate_id':'a'}], 'coverage_decisions':[
            {'candidate_id':'a','decision':'include','reason':'Material disruption'},
            {'candidate_id':'b','decision':'duplicate','reason':'Same event as a'}]}
        self.assertIn('discovery',d.validate_decisions(audit,copy.deepcopy(data))['notion_entries'][0])
        for mutation in [dict(data,coverage_decisions=data['coverage_decisions'][:1]),
                         dict(data,notion_entries=[]),dict(data,notion_entries=[{'candidate_id':'unknown'}])]:
            with self.assertRaises(ValueError):d.validate_decisions(audit,mutation)

    def test_completed_desk_reuses_receipt_without_research(self):
        api=Mock();api.ledger.return_value=({}, {'phase':'completed','saved':5})
        with patch.object(editor,'DRY_RUN',False),patch.object(release,'Notion',return_value=api),patch.object(editor,'generate_briefing') as research,patch.object(editor,'fetch_existing_entries') as fetch:
            self.assertEqual(editor.run_group('uae_middle_east')['entry_count'],5)
        research.assert_not_called();fetch.assert_not_called()


class RankingTests(unittest.TestCase):
    def records(self):
        return [{'id':str(i),'created_time':str(100-i),'properties':{'Category':{'select':{'name':'UAE & Middle East Desk'}}}} for i in range(9)]

    def assessments(self):
        return [{'id':str(i),'urgency':5 if i==0 else 2,'consequence':5 if i==0 else 1,'reach':4,'rationale':'Airport attack' if i==0 else 'Developing announcement'} for i in range(9)]

    def test_critical_story_wins_regardless_of_insert_order_and_retry_reuses(self):
        rows=self.records();state={};api=Mock();api.ledger.return_value=({},state)
        client=Mock();client.messages.stream.return_value=stream(response({'assessments':self.assessments()},False))
        with patch.object(selection.anthropic,'Anthropic',return_value=client):
            first=selection.select(api,'2026-10-23',rows,lambda p,n:p['id']+n)
            second=selection.select(api,'2026-10-23',list(reversed(rows)),lambda p,n:p['id']+n)
        self.assertEqual(first[0]['id'],'0');self.assertEqual(first,second)
        self.assertEqual(len(first),7);client.messages.stream.assert_called_once()

    def test_missing_or_duplicate_rankings_fail_before_selection_writes(self):
        for bad in [self.assessments()[:-1],self.assessments()[:-1]+[self.assessments()[0]]]:
            api=Mock();api.ledger.return_value=({}, {})
            client=Mock();client.messages.stream.return_value=stream(response({'assessments':bad},False))
            with patch.object(selection.anthropic,'Anthropic',return_value=client),self.assertRaises(ValueError):
                selection.select(api,'2026-10-23',self.records(),lambda p,n:p['id']+n)
            api.save_ledger.assert_not_called()

    def test_changed_snapshot_cannot_silently_rerank(self):
        api=Mock();api.ledger.return_value=({}, {'fingerprint':'old','assessments':[]})
        with patch.object(selection.anthropic,'Anthropic') as provider,self.assertRaisesRegex(RuntimeError,'input changed'):
            selection.select(api,'2026-10-23',self.records(),lambda p,n:p['id']+n)
        provider.assert_not_called()

    def test_routine_items_do_not_pad_selection_to_seven(self):
        scores=self.assessments()
        for score in scores[1:]:score['urgency']=1
        api=Mock();api.ledger.return_value=({}, {})
        client=Mock();client.messages.stream.return_value=stream(response({'assessments':scores},False))
        with patch.object(selection.anthropic,'Anthropic',return_value=client):
            chosen=selection.select(api,'2026-10-23',self.records(),lambda p,n:p['id']+n)
        self.assertEqual([p['id'] for p in chosen],['0'])
