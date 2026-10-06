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
        r,g,c,q=self.run_review([None]);self.assertEqual(r['notion_entries'],[]);c.assert_not_called();q.assert_called_once()
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
