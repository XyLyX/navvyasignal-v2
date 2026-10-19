import copy
import datetime as dt
import json
import os
import unittest
from unittest.mock import Mock,patch
from pipeline import editorial_formats as f
from pipeline import regional_release as r
from pipeline import recover_editorial_formats as recovery
from pipeline import refresh_publication as refresh
from pipeline.test_regional_release import page


class EditorialFormatsTests(unittest.TestCase):
    def test_completed_week_on_monday_and_catchup_tuesday(self):
        for edition in ('2026-10-19','2026-10-20','2026-10-25'):
            self.assertEqual(tuple(map(str,f.periods(edition)['Briefing'])),('2026-10-12','2026-10-18'))
        self.assertEqual(tuple(map(str,f.periods('2026-10-26')['Long Read'])),('2026-10-19','2026-10-25'))

    def test_balanced_inputs_do_not_crowd_out_days_or_desks(self):
        rows=[{'date':day,'desk':desk,'id':str(i)} for day in ('2026-10-12','2026-10-18')
              for desk in ('India Desk','Europe Desk') for i in range(10)]
        result=f.balanced(rows,4)
        self.assertEqual(len({(p['date'],p['desk']) for p in result}),4)

    def test_source_filter_uses_approved_staging_not_arbitrary_unchecked_drafts(self):
        pub=page(r.RELEASED+json.dumps({'policy':'regional-v1','edition':'2026-10-19'}),True)
        staged=page(r.pending_note(edition='2026-10-19'));staged['id']='second'
        held=page('V2_UNVERIFIED_SIGNAL:held');held['id']='held'
        api=Mock();api.query.return_value=[pub,staged,held]
        rows=f.inputs(api,dt.date(2026,10,19),dt.date(2026,10,19),'2026-10-19')
        self.assertEqual({row['id'] for row in rows},{pub['id'],'second'})

    def test_staged_update_supersedes_original_only_in_private_inputs(self):
        original=page(r.RELEASED+json.dumps({'policy':'regional-v1','edition':'2026-10-19'}),True)
        staged=page(r.pending_note(target=original['id'],edition='2026-10-19'));staged['id']='staging'
        api=Mock();api.query.return_value=[original,staged]
        rows=f.inputs(api,dt.date(2026,10,19),dt.date(2026,10,19),'2026-10-19')
        self.assertEqual(len(rows),1);self.assertTrue(rows[0]['staged'])

    def test_long_read_is_reviewed_in_sections_without_1800_character_truncation(self):
        entry={'title':'Checked title','body_markdown':'\n\n'.join(['A documented paragraph. '*28]*8),
               'sources_text':'https://example.com/a','desk':'North America Desk','action':'create','notes':'Full report'}
        editor=Mock()
        editor.verify_with_gemini_loop.side_effect=lambda value:value
        result=f.review(editor,entry)
        self.assertEqual(editor.verify_with_gemini_loop.call_count,4)
        self.assertEqual(result['body_markdown'],entry['body_markdown'])
        self.assertGreater(len(result['body_markdown']),1800)
        for call in editor.verify_with_gemini_loop.call_args_list:
            section=call.args[0]['notion_entries'][0]
            self.assertLessEqual(len(section['body_markdown']),1800)
            self.assertEqual(section['full_draft'],entry)

    def test_one_held_section_prevents_whole_long_read_publication(self):
        editor=Mock();editor.verify_with_gemini_loop.return_value={'notion_entries':[]}
        result=f.review(editor,{'title':'Full','body_markdown':'One.\n\nTwo.','notes':'','desk':'North America Desk','action':'create'})
        self.assertIsNone(result)

    def test_stage_sets_regional_category_and_pending_marker_and_long_read_type(self):
        api=Mock(source='source');api.call.return_value={'id':'new'}
        entry={'title':'Report','desk':'Europe Desk','body_markdown':'Long body','sources_text':'https://example.com/a',
               'content_type':'Long Read','related_desks':['North America Desk'],'notes':'Reviewed'}
        self.assertEqual(f.stage(api,entry,'key','2026-10-19',dt.date(2026,10,12),dt.date(2026,10,18),10,10),'new')
        props=api.call.call_args.args[2]['properties']
        self.assertFalse(props['Ready to Post']['checkbox'])
        self.assertTrue(props['Long Read']['checkbox'])
        p={'properties':props}
        self.assertIsNotNone(r.pending(p,'2026-10-19'))

    def test_special_formats_do_not_displace_seven_daily_signals(self):
        special=page(r.RELEASED+json.dumps({'edition':'2026-10-19'}),True)
        special['properties']['Content Type']={'select':{'name':'Briefing'}}
        api=Mock();api.query.return_value=[special]
        self.assertEqual(r.select_homepage(api,'2026-10-19'),[])
        api.patch.assert_not_called()

    def test_terminal_weekly_ledger_avoids_repeated_paid_generation(self):
        api=Mock();api.ledger.return_value=({}, {'status':'staged'})
        editor=Mock()
        with patch.dict(os.environ,{'DRY_RUN':'false'}):
            result=f.run('2026-10-19',api,editor)
        self.assertEqual(set(result.values()),{'staged'})
        editor.client.messages.stream.assert_not_called();api.query.assert_not_called()

    def test_dry_run_has_no_models_writes_or_builds(self):
        api=Mock();editor=Mock()
        with patch.dict(os.environ,{'DRY_RUN':'true'}):
            self.assertEqual(f.run('2026-10-19',api,editor),{})
        api.ledger.assert_not_called();editor.client.messages.stream.assert_not_called()

    def test_explicit_code_recovery_builds_once_even_when_content_matches(self):
        current=[{'id':'a','digest':'same'}]
        state={'phase':'released','key':'manual'}
        api=Mock()
        hook=Mock();hook.__enter__=Mock(return_value=Mock(status=200));hook.__exit__=Mock(return_value=False)
        with patch.object(refresh,'fetch_entries',return_value=current),patch.object(refresh,'request',return_value={'version':1,'entries':current}),patch('urllib.request.urlopen',return_value=hook) as post,patch.object(refresh,'wait_for_publication'),patch.dict(os.environ,{'V2_NETLIFY_BUILD_HOOK':'https://api.netlify.com/build_hooks/test'}):
            r.publish_once(api,{},state,force_build=True)
            r.publish_once(api,{},state,force_build=True)
        post.assert_called_once()
        self.assertEqual(state['phase'],'verified')

    def test_daily_release_cannot_force_code_rollout(self):
        with self.assertRaisesRegex(ValueError,'explicit manual'):
            r.run('2026-10-19',dt.datetime.fromisoformat('2026-10-19T05:00:00Z'),force_build=True)

    def test_recovery_request_is_explicit_fresh_and_not_future_dated(self):
        now=dt.datetime.fromisoformat('2026-10-19T10:00:00Z')
        value={'action':'recover-editorial-formats','policy':'regional-v1','edition_date':'2026-10-19','requested_at':'2026-10-19T09:00:00Z'}
        self.assertEqual(recovery.request(value,now),'2026-10-19')
        for update in ({'action':'research-all-desks'},{'requested_at':'2026-10-17T09:00:00Z'},{'edition_date':'2026-10-20'}):
            with self.assertRaises(ValueError):recovery.request(dict(value,**update),now)


class EditorialDraftValidationTests(unittest.TestCase):
    def test_paragraph_character_target_is_not_a_factual_approval_gate(self):
        editor=Mock(DESKS=['North America Desk','Europe Desk'])
        rows=[{'id':'source','sources':'https://example.com/source'}]
        data={'has_report':True,'title':'A supported connection','primary_desk':'Europe Desk',
              'related_desks':['North America Desk'],'paragraphs':['A'*850,'B'*800],'source_ids':['source']}
        entry=f.draft(data,rows,'Cross-Desk',dt.date(2026,10,19),dt.date(2026,10,19),editor)
        self.assertEqual(len(entry['body_markdown']),1652)
        data['source_ids']=['invented']
        with self.assertRaisesRegex(ValueError,'supplied source records'):
            f.draft(data,rows,'Cross-Desk',dt.date(2026,10,19),dt.date(2026,10,19),editor)

    def test_weekly_title_is_the_completed_period_not_generated_date_claim(self):
        editor=Mock(DESKS=['Europe Desk'])
        rows=[{'id':'source','sources':'https://example.com/source'}]
        data={'has_report':True,'title':'Generated title','primary_desk':'Europe Desk','related_desks':[],
              'paragraphs':['A paragraph.']*4,'source_ids':['source']}
        entry=f.draft(data,rows,'Briefing',dt.date(2026,10,12),dt.date(2026,10,18),editor)
        self.assertEqual(entry['title'],'Weekly Briefing — 2026-10-12 to 2026-10-18')
