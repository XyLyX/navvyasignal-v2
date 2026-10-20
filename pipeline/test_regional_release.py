import copy
import datetime as dt
import json
import os
import unittest
from unittest.mock import Mock,patch
from pipeline import regional_release as r
from pipeline import manual_editorial_action as action
from pipeline import refresh_publication as refresh


def page(note=None,ready=False,desk='North America Desk'):
    return {'id':'11111111-1111-1111-1111-111111111111','created_time':'2026-10-18T22:35:00Z',
        'parent':{'data_source_id':'source'},'properties':{
        'Name':{'type':'title','title':[{'plain_text':'Checked headline'}]},
        'Category':{'type':'select','select':{'name':desk}},
        'Signal Brief':{'type':'rich_text','rich_text':[{'plain_text':'Facts.\n\nConsequences.'}]},
        'Text 1':{'type':'rich_text','rich_text':[{'plain_text':'https://example.com/source'}]},
        'Ready to Post':{'type':'checkbox','checkbox':ready},
        'Internal Note':{'type':'rich_text','rich_text':[{'plain_text':note or r.pending_note(edition='2026-10-19')}]}}}


class RegionalReleaseTests(unittest.TestCase):
    def test_empty_daily_release_never_verifies_production(self):
        api=Mock();api.ledger.return_value=({}, {'phase':'staging','key':'day'})
        api.query.return_value=[]
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(r,'Notion',return_value=api),patch.object(r,'require_completed_desks'),patch.object(r,'publish_once') as publish:
            with self.assertRaisesRegex(RuntimeError,'No approved Signals'):r.run('2026-10-19')
        publish.assert_not_called()

    def test_explicit_repair_of_empty_verified_edition_selects_fresh_signals(self):
        api=Mock();state={'phase':'verified','key':'day','entry_ids':[]};api.ledger.return_value=({},state)
        api.query.return_value=[]
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(r,'Notion',return_value=api),patch.object(r,'require_completed_desks'),patch.object(r,'select_homepage',return_value=['new']),patch.object(r,'publish_once') as publish:
            r.run('2026-10-19',repair_empty=True)
        self.assertEqual(state['entry_ids'],['new']);self.assertEqual(state['phase'],'released');publish.assert_called_once()

    def test_missing_config_fails_before_network(self):
        with patch.dict(os.environ,{},clear=True),patch.object(r.requests,'request') as network:
            with self.assertRaisesRegex(RuntimeError,'NOTION_DATA_SOURCE_ID'):r.Notion()
        network.assert_not_called()

    def test_incomplete_desks_cannot_release(self):
        api=Mock();api.query.return_value=[]
        with self.assertRaisesRegex(RuntimeError,'north_america'):r.require_completed_desks(api,'2026-10-20')

    def test_all_four_desk_receipts_are_required(self):
        receipt=page(r.LEDGER+'key\n'+json.dumps({'phase':'completed'}))
        api=Mock();api.query.return_value=[receipt]
        r.require_completed_desks(api,'2026-10-20')
        self.assertEqual(api.query.call_count,4)

    def test_only_explicit_current_policy_approvals_release(self):
        p=page();self.assertTrue(r.pending(p,'2026-10-19'))
        for note in ['ordinary draft','V2_UNVERIFIED_SIGNAL:abc\nHeld',r.pending_note(edition='2026-10-20'),r.pending_note(edition='2026-10-19').replace('regional-v1','old-policy')]:
            self.assertIsNone(r.pending(page(note),'2026-10-19'))
        self.assertIsNone(r.pending(page(ready=True),'2026-10-19'))
        self.assertIsNone(r.pending(page(desk='Technology & AI Desk'),'2026-10-19'))

    def test_schedule_boundary_and_dubai_date(self):
        self.assertEqual(r.next_release(dt.datetime.fromisoformat('2026-10-19T04:59:59+00:00')),'2026-10-19')
        self.assertEqual(r.next_release(dt.datetime.fromisoformat('2026-10-19T05:00:00+00:00')),'2026-10-20')
        self.assertEqual(r.next_release(dt.datetime.fromisoformat('2026-10-19T22:30:00+00:00')),'2026-10-20')

    def test_no_release_before_nine(self):
        with patch.object(r,'Notion') as api:
            with self.assertRaisesRegex(ValueError,'09:00'):r.run('2026-10-19',dt.datetime.fromisoformat('2026-10-19T04:59:00Z'))
        api.assert_not_called()

    def test_release_sets_ready_and_publication_marker(self):
        api=Mock(source='source');p=page();api.call.return_value=p
        self.assertEqual(r.release_page(api,p,'2026-10-19'),p['id'])
        props=api.patch.call_args.args[1]['properties']
        self.assertTrue(props['Ready to Post']['checkbox'])
        self.assertTrue(props['Internal Note']['rich_text'][0]['text']['content'].startswith(r.RELEASED))

    def test_human_edit_or_deleted_draft_is_rechecked(self):
        api=Mock(source='source');api.call.return_value=page('V2_UNVERIFIED_SIGNAL:edited')
        self.assertIsNone(r.release_page(api,page(),'2026-10-19'));api.patch.assert_not_called()

    def test_staged_update_only_changes_public_target_at_release(self):
        target='22222222-2222-2222-2222-222222222222'
        p=page(r.pending_note(target=target,edition='2026-10-19'))
        api=Mock(source='source');api.call.side_effect=[p,page(ready=True)]
        self.assertEqual(r.release_page(api,p,'2026-10-19'),target)
        self.assertEqual(api.patch.call_args_list[0].args[0],target)
        self.assertEqual(api.patch.call_args_list[1].args,(p['id'],{'in_trash':True}))

    def test_first_build_persists_request_before_hook_and_verifies(self):
        api=Mock();events=[];api.save_ledger.side_effect=lambda *a:events.append(a[1]['phase'])
        hook=Mock();hook.__enter__=Mock(return_value=Mock(status=200));hook.__exit__=Mock(return_value=False)
        state={'phase':'released','key':'day'}
        with patch.object(refresh,'fetch_entries',return_value=[{'id':'a','digest':'new'}]),patch.object(refresh,'request',return_value={'version':1,'entries':[]}),patch('urllib.request.urlopen',return_value=hook) as post,patch.object(refresh,'wait_for_publication') as wait,patch.dict(os.environ,{'V2_NETLIFY_BUILD_HOOK':'https://api.netlify.com/build_hooks/test'}):
            r.publish_once(api,{},state)
        post.assert_called_once();wait.assert_called_once()
        self.assertEqual(events,['build_requested','verified'])

    def test_pending_build_retry_never_requests_another_hook(self):
        current=[{'id':'a','digest':'new'}]
        import hashlib
        state={'phase':'build_requested','key':'day','fingerprint':hashlib.sha256(json.dumps(current,sort_keys=True).encode()).hexdigest()}
        with patch.object(refresh,'fetch_entries',return_value=current),patch.object(refresh,'request',return_value={'version':1,'entries':[]}),patch('urllib.request.urlopen') as hook,patch.object(refresh,'wait_for_publication') as wait:
            r.publish_once(Mock(),{},state)
        hook.assert_not_called();wait.assert_called_once()

    def test_verified_release_cannot_trigger_second_daily_build(self):
        with patch.object(refresh,'fetch_entries',return_value=[{'id':'a','digest':'new'}]),patch.object(refresh,'request',return_value={'version':1,'entries':[]}),patch('urllib.request.urlopen') as hook:
            with self.assertRaisesRegex(RuntimeError,'already completed'):r.publish_once(Mock(),{}, {'phase':'verified','key':'day'})
        hook.assert_not_called()

    def test_raw_refresh_cannot_build(self):
        with patch.object(refresh,'fetch_entries',return_value=[{'id':'a','digest':'new'}]),patch.object(refresh,'request',return_value={'version':1,'entries':[]}),patch('urllib.request.urlopen') as hook,patch.dict(os.environ,{'DRY_RUN':'false'}):
            with self.assertRaisesRegex(RuntimeError,'retired'):refresh.main()
        hook.assert_not_called()

    def test_homepage_represents_each_available_region_without_models(self):
        rows=[]
        for i,d in enumerate(r.POLICY['desks']):
            p=page(r.RELEASED+json.dumps({'edition':'2026-10-19'}),True,d['notion']);p['id']=str(i);rows.append(p)
        api=Mock();api.query.return_value=rows
        self.assertEqual(len(r.select_homepage(api,'2026-10-19')),4)
        self.assertEqual(api.patch.call_count,4)


class ManualActionTests(unittest.TestCase):
    def api(self):
        api=Mock(source='source');api.call.return_value=page('V2_UNVERIFIED_SIGNAL:abc\nHeld');return api
    def test_scheduled_stays_unchecked_until_next_release(self):
        api=self.api();action.apply(api,page()['id'],'scheduled','Verified sources',now=dt.datetime.fromisoformat('2026-10-19T06:00:00Z'))
        props=api.patch.call_args.args[1]['properties']
        self.assertFalse(props['Ready to Post']['checkbox'])
        note=props['Internal Note']['rich_text'][0]['text']['content'];self.assertTrue(note.startswith(r.PENDING));self.assertIn('2026-10-20',note)
    def test_now_is_explicitly_public_and_audited(self):
        api=self.api();action.apply(api,page()['id'],'now','Verified sources')
        props=api.patch.call_args.args[1]['properties'];self.assertTrue(props['Ready to Post']['checkbox']);self.assertTrue(props['Internal Note']['rich_text'][0]['text']['content'].startswith(r.RELEASED))
    def test_delete_trashes_notion_record_without_approval(self):
        api=self.api();action.apply(api,page()['id'],'delete');api.patch.assert_called_once_with(page()['id'],{'in_trash':True})
    def test_public_or_foreign_page_cannot_be_deleted(self):
        for p in [page(ready=True),dict(page('V2_UNVERIFIED_SIGNAL:abc'),parent={'data_source_id':'other'})]:
            api=self.api();api.call.return_value=p
            with self.assertRaises(ValueError):action.apply(api,page()['id'],'delete')
            api.patch.assert_not_called()
    def test_unresolved_approval_fails_closed(self):
        api=self.api()
        with self.assertRaises(ValueError):action.apply(api,page()['id'],'scheduled','')
        api.patch.assert_not_called()
