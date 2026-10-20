import datetime as dt
import os
import unittest
from unittest.mock import Mock,patch
from pipeline import manual_current_edition as manual
from pipeline import regional_release as release
from pipeline import main as editor

class ManualEditionTests(unittest.TestCase):
    def test_full_recovery_orders_formats_release_and_delivery(self):
        from pipeline import editorial_formats as formats
        api=Mock();api.ledger.return_value=({}, {'key':'request'})
        events=[]
        with patch.dict(os.environ,{'DRY_RUN':'false','V2_FULL_RECOVERY':'true'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group',return_value={'entry_count':1,'notion_summary':['a']}),patch.object(formats,'run',side_effect=lambda *a,**k:events.append('formats') or {'Cross-Desk':'staged'}),patch.object(release,'run',side_effect=lambda *a,**k:events.append('release')) as publish,patch.object(editor,'main',side_effect=lambda:events.append('send')),patch.object(editor,'RUN_TYPE',''):
            manual.run('2026-10-20','42')
        self.assertEqual(events,['formats','release','send'])
        publish.assert_called_once_with('2026-10-20',repair_empty=True)

    def test_full_recovery_never_sends_when_a_desk_fails(self):
        api=Mock();api.ledger.return_value=({}, {'key':'request'})
        result={'entry_count':1,'notion_summary':['a']}
        with patch.dict(os.environ,{'DRY_RUN':'false','V2_FULL_RECOVERY':'true'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group',side_effect=[RuntimeError(),result,result,result]),patch.object(release,'run') as publish,patch.object(editor,'main') as send:
            with self.assertRaisesRegex(RuntimeError,'Full recovery withheld'):manual.run('2026-10-20','42')
        publish.assert_not_called();send.assert_not_called()

    def test_dry_run_does_not_research_or_release(self):
        with patch.dict(os.environ,{'DRY_RUN':'true'}),patch.object(editor,'run_group') as research,patch.object(release,'run') as publish:
            manual.run('2026-10-19','42')
        research.assert_not_called();publish.assert_not_called()
    def test_four_regional_runs_then_one_explicit_release(self):
        api=Mock();api.ledger.return_value=({}, {'key':'request','phase':'staging'})
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group',return_value={'entry_count':2,'notion_summary':['a','b']}) as research,patch.object(release,'run') as publish:
            manual.run('2026-10-19','42')
        self.assertEqual([c.args[0] for c in research.call_args_list],[d['key'] for d in release.POLICY['desks']])
        publish.assert_called_once_with('2026-10-19',manual_key='42')
    def test_partial_provider_failure_retains_and_releases_other_desks(self):
        api=Mock();api.ledger.return_value=({}, {'key':'request','phase':'staging'})
        result={'entry_count':1,'notion_summary':['a']}
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group',side_effect=[RuntimeError(),result,result,result]),patch.object(release,'run') as publish:
            with self.assertRaisesRegex(RuntimeError,'Partial'):manual.run('2026-10-19','42')
        publish.assert_called_once()
    def test_request_retry_skips_completed_research(self):
        complete={d['key']:{'approved':1,'saved':1} for d in release.POLICY['desks']}
        api=Mock();api.ledger.return_value=({}, {'key':'request','completed':complete})
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group') as research,patch.object(release,'run') as publish:
            manual.run('2026-10-19','42')
        research.assert_not_called();publish.assert_called_once()
    def test_no_approved_stories_cannot_claim_a_site_update(self):
        api=Mock();api.ledger.return_value=({}, {'key':'request'})
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(release,'Notion',return_value=api),patch.object(editor,'run_group',return_value={'entry_count':0,'notion_summary':[]}),patch.object(release,'run') as publish:
            with self.assertRaisesRegex(RuntimeError,'No fresh'):manual.run('2026-10-19','42')
        publish.assert_not_called()
    def test_explicit_manual_release_can_run_before_nine_without_affecting_daily_gate(self):
        api=Mock();api.ledger.return_value=({}, {'phase':'released','key':'manual'})
        api.ensure_schema.return_value=None
        with patch.dict(os.environ,{'DRY_RUN':'false'}),patch.object(release,'Notion',return_value=api),patch.object(release,'publish_once'):
            release.run('2026-10-19',dt.datetime.fromisoformat('2026-10-19T03:30:00Z'),manual_key='42')
        self.assertEqual(api.ledger.call_args.args[0],'regional-v1/manual/42')

class CheckpointResumeTests(unittest.TestCase):
    def test_resume_reuses_completed_research_and_sends_after_release(self):
        from pipeline import editorial_formats as formats
        import json
        complete={d['key']:{'approved':1,'saved':1} for d in release.POLICY['desks']}
        state={'key':'request','completed':complete}
        record={'properties':{'Internal Note':{'rich_text':[{'plain_text':'marker\n'+json.dumps(state)}]}}}
        api=Mock();api.query.return_value=[record];api.ledger.return_value=({},state)
        with patch.dict(os.environ,{'DRY_RUN':'false','V2_FULL_RECOVERY':'true','V2_RESUME_RESEARCH_RUN_ID':'39398538131'}),patch.object(release,'Notion',return_value=api),patch.object(release,'require_completed_desks'),patch.object(editor,'run_group') as research,patch.object(formats,'run',return_value={'Cross-Desk':'staged'}),patch.object(release,'run') as publish,patch.object(editor,'main') as send,patch.object(editor,'RUN_TYPE',''):
            manual.run('2026-10-20','new-run')
        research.assert_not_called()
        api.ledger.assert_called_once_with('regional-v1/manual-research/39398538131')
        publish.assert_called_once_with('2026-10-20',repair_empty=True)
        send.assert_called_once()
