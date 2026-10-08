import os, unittest, hashlib, json
os.environ.setdefault('ANTHROPIC_API_KEY', 'test-only')
from unittest.mock import patch
from pipeline import main

class Response:
    def __init__(self, data, status=200): self.data=data; self.status_code=status
    def json(self): return self.data

class FinalDiscardTests(unittest.TestCase):
    def draft(self):
        return {'notion_entries':[{'title':'Draft','desk':'UAE Desk','desk_ambiguous':False,'action':'create','body_markdown':'Facts.\n\nConsequences.','sources_text':'https://example.com/report'}], 'editorial_decision':{'ready_to_post':False,'disposition':'discard','rationale':'Do not publish unsupported central claim','evidence':['https://example.com/report contradicts claim'],'unverified_claims':[]}}

    def test_final_rejection_skips_recovery_and_queue(self):
        d=self.draft()
        with patch.object(main,'gemini_review',return_value='FLAGS: 1\n- Unsupported'),patch.object(main,'claude_respond_to_flags',return_value=d) as claude,patch.object(main,'discard_rejected_draft') as discard,patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(d)
        self.assertEqual(result['notion_entries'],[])
        claude.assert_called_once();discard.assert_called_once();queue.assert_not_called()

    def test_recovery_rejection_discards(self):
        d=self.draft()
        with patch.object(main,'gemini_review',return_value=None),patch.object(main,'claude_respond_to_flags',return_value=d),patch.object(main,'discard_rejected_draft') as discard,patch.object(main,'save_unverified_signal') as queue:
            main.verify_with_gemini_loop(d)
        discard.assert_called_once();queue.assert_not_called()

    def test_bad_discard_verdict_cannot_delete(self):
        for field,value in [('evidence',[]),('ready_to_post',True)]:
            d=self.draft();original=dict(d['notion_entries'][0]);d['editorial_decision'][field]=value
            with self.assertRaises(ValueError):main.reject_if_final(d,original)
        d=self.draft();original=dict(d['notion_entries'][0]);d['notion_entries'][0]['existing_id']='other'
        with self.assertRaises(ValueError):main.reject_if_final(d,original)

    def test_technical_hold_stays_private(self):
        d=self.draft();d['editorial_decision']['disposition']='hold'
        with patch.object(main,'gemini_review',return_value=None),patch.object(main,'claude_respond_to_flags',return_value=d),patch.object(main,'discard_rejected_draft') as discard,patch.object(main,'save_unverified_signal') as queue:
            main.verify_with_gemini_loop(d)
        discard.assert_not_called();queue.assert_called_once()

    def test_delete_only_matching_private_draft(self):
        draft=self.draft()['notion_entries'][0];draft['existing_id']='published-target'
        marker='V2_UNVERIFIED_SIGNAL:'+hashlib.sha256(json.dumps([draft.get('title'),draft.get('desk'),draft.get('body_markdown')],ensure_ascii=False).encode()).hexdigest()
        def page(id,ready=False,note=marker):
            return {'id':id,'properties':{'Ready to Post':{'checkbox':ready},'Internal Note':{'rich_text':[{'plain_text':note+'\nReason'}]}}}
        pages=[page('private'),page('approved',True),page('published-target'),page('unrelated',False,'Other')]
        with patch.object(main,'DRY_RUN',False),patch.object(main.requests,'post',side_effect=[Response({'results':pages}),Response({'results':[]})]),patch.object(main.requests,'patch',return_value=Response({})) as trash:
            main.discard_rejected_draft(draft,draft)
        trash.assert_called_once();self.assertTrue(trash.call_args.args[0].endswith('/private'))
        self.assertEqual(trash.call_args.kwargs['json'],{'archived':True})

    def test_dry_run_does_not_delete(self):
        d=self.draft()['notion_entries'][0]
        with patch.object(main,'DRY_RUN',True),patch.object(main.requests,'post') as query,patch.object(main.requests,'patch') as trash:
            main.discard_rejected_draft(d,d)
        query.assert_not_called();trash.assert_not_called()

    def test_failure_remains_visible(self):
        d=self.draft()['notion_entries'][0]
        with patch.object(main,'DRY_RUN',False),patch.object(main.requests,'post',return_value=Response({},503)):
            with self.assertRaisesRegex(RuntimeError,'Rejected draft lookup failed'):main.discard_rejected_draft(d,d)
