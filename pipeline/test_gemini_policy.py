import os, unittest
os.environ.setdefault('ANTHROPIC_API_KEY','test-only')
from unittest.mock import patch
from pipeline import main

class GeminiPolicyTests(unittest.TestCase):
    def draft(self, ready=None, unresolved=False):
        d={'notion_entries':[{'title':'Draft','desk':'UAE Desk','desk_ambiguous':False,'action':'create','body_markdown':'Facts.\n\nConsequences.','sources_text':'https://example.com/report'}]}
        if ready is not None:
            d['editorial_decision']={'ready_to_post':ready,'rationale':'Supported common ground','evidence':['https://example.com/report supports facts'],'unverified_claims':['minor detail'] if unresolved else []}
        if unresolved:d['notion_entries'][0]['body_markdown']="Facts; a minor detail couldn't be verified from source.\n\nConsequences."
        return d
    def run_review(self, reviews, repaired=None):
        with patch.object(main,'gemini_review',side_effect=reviews) as gem,patch.object(main,'claude_respond_to_flags',return_value=repaired) as claude,patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(self.draft())
        return result,gem,claude,queue
    def test_clean_pass_no_repair(self):
        r,g,c,q=self.run_review(['FLAGS: 0']);self.assertEqual(len(r['notion_entries']),1);c.assert_not_called();q.assert_not_called()
    def test_ambiguity_repaired_and_rechecked(self):
        r,g,c,q=self.run_review(['FLAGS: 1\n- Figure','FLAGS: 0'],self.draft(True));self.assertEqual(len(r['notion_entries']),1);self.assertEqual(g.call_count,2);c.assert_called_once()
    def test_not_ready_held(self):
        r,g,c,q=self.run_review(['FLAGS: 1\n- Claim'],self.draft(False));self.assertEqual(r['notion_entries'],[]);q.assert_called_once()
    def test_provider_failure_held(self):
        r,g,c,q=self.run_review([None]);self.assertEqual(r['notion_entries'],[]);c.assert_called_once();q.assert_called_once()
    def test_malformed_review_held(self):
        r,g,c,q=self.run_review(['FLAGS: 0\n- Concern']);self.assertEqual(r['notion_entries'],[])
    def test_repeated_objection_final_source_adjudication(self):
        r,g,c,q=self.run_review(['FLAGS: 1\n- Calendar','FLAGS: 1\n- Calendar'],self.draft(True));self.assertEqual(len(r['notion_entries']),1);self.assertEqual(c.call_count,2);self.assertTrue(c.call_args.kwargs['is_repeat_concern'])
    def test_uncertainty_label_preserved(self):
        r,g,c,q=self.run_review(['FLAGS: 1\n- Detail','FLAGS: 0'],self.draft(True,True));self.assertIn("couldn't be verified from source",r['notion_entries'][0]['body_markdown'])
    def test_missing_label_held(self):
        d=self.draft(True);d['editorial_decision']['unverified_claims']=['detail'];r,g,c,q=self.run_review(['FLAGS: 1\n- Detail'],d);self.assertEqual(r['notion_entries'],[])
    def test_missing_explicit_approval_held(self):
        r,g,c,q=self.run_review(['FLAGS: 1\n- Detail'],self.draft());self.assertEqual(r['notion_entries'],[])
    def test_paid_repair_enabled(self):
        with patch.object(main,'fit_signal_briefs',side_effect=lambda d:d) as fit,patch.object(main,'gemini_review',return_value='FLAGS: 0'):
            main.verify_with_gemini_loop(self.draft())
        self.assertNotIn('_no_paid_rewrite',fit.call_args.args[0])

    def test_verbose_evidence_compacted_without_losing_citations(self):
        d=self.draft(True)
        d['notion_entries'][0]['sources_text']='https://example.com/one '+('Evidence description. '*110)+' https://example.com/two'
        r,g,c,q=self.run_review(['FLAGS: 1\n- Detail','FLAGS: 0'],d)
        self.assertEqual(r['notion_entries'][0]['sources_text'],'https://example.com/one\nhttps://example.com/two')
        q.assert_not_called()

    def test_gemini_outage_recovers_with_claude_final_verdict(self):
        r,g,c,q=self.run_review([None],self.draft(True))
        self.assertEqual(len(r['notion_entries']),1)
        self.assertEqual(r['unverified_count'],0)
        c.assert_called_once();q.assert_not_called()

    def test_recovery_cannot_change_update_target(self):
        d=self.draft(True);d['notion_entries'][0]['existing_id']='other-page'
        r,g,c,q=self.run_review([None],d)
        self.assertEqual(r['notion_entries'],[]);q.assert_called_once()
        self.assertIn('Recovery changed story identity',q.call_args.args[1])

    def test_recovery_rejects_oversized_brief_without_unreviewed_rewrite(self):
        d=self.draft(True);d['notion_entries'][0]['body_markdown']='x'*1801+'\n\nConsequences.'
        r,g,c,q=self.run_review([None],d)
        self.assertEqual(r['notion_entries'],[]);q.assert_called_once()

    def test_recovery_uses_latest_draft_and_retains_original_failure(self):
        repaired=self.draft(False)
        repaired['notion_entries'][0]['title']='Corrected headline'
        with patch.object(main,'gemini_review',return_value='FLAGS: 1\n- Concern'),patch.object(main,'claude_respond_to_flags',return_value=repaired) as claude,patch.object(main,'save_unverified_signal') as queue:
            main.verify_with_gemini_loop(self.draft())
        self.assertEqual(claude.call_count,2)
        self.assertEqual(claude.call_args.args[0]['notion_entries'][0]['title'],'Corrected headline')
        self.assertIn('Initial hold:',queue.call_args.args[1])
        self.assertIn('Recovery Claude withheld publication',queue.call_args.args[1])

    def test_recovery_provider_error_stays_private(self):
        with patch.object(main,'gemini_review',return_value=None),patch.object(main,'claude_respond_to_flags',side_effect=TimeoutError('secret must not appear')),patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(self.draft())
        self.assertEqual(result['unverified_count'],1)
        self.assertIn('TimeoutError',queue.call_args.args[1])
        self.assertNotIn('secret must not appear',queue.call_args.args[1])

    def test_recovery_requires_evidence(self):
        d=self.draft(True);d['editorial_decision']['evidence']=[]
        r,g,c,q=self.run_review([None],d)
        self.assertEqual(r['notion_entries'],[]);q.assert_called_once()

    def test_recovery_requires_confirmed_desk(self):
        d=self.draft(True);d['notion_entries'][0]['desk_ambiguous']=True
        r,g,c,q=self.run_review([None],d)
        self.assertEqual(r['notion_entries'],[]);q.assert_called_once()

    def test_recovery_can_supply_missing_sources(self):
        d=self.draft();d['notion_entries'][0]['sources_text']='No direct URL'
        with patch.object(main,'gemini_review') as gem,patch.object(main,'claude_respond_to_flags',return_value=self.draft(True)) as claude,patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(d)
        gem.assert_not_called();claude.assert_called_once();queue.assert_not_called()
        self.assertEqual(len(result['notion_entries']),1)
