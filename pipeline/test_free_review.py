import os
os.environ.setdefault('ANTHROPIC_API_KEY','test-placeholder')
import unittest
from unittest.mock import patch
from pipeline import main, free_review

class Response:
    def __init__(self,content='{"concerns":[]}',status=200):self.content=content;self.status_code=status
    def json(self):return {'choices':[{'message':{'content':self.content}}]}

class FreeReviewTests(unittest.TestCase):
    def draft(self):return {'notion_entries':[{'title':'Draft','desk':'UAE Desk','desk_ambiguous':False,'body_markdown':'Facts.\n\nConsequences.','sources_text':'https://example.com/report'}]}
    def test_no_key_never_calls_provider(self):
        with patch.dict(os.environ,{'GROQ_API_KEY':''}),patch.object(free_review.requests,'post') as post:
            with self.assertRaisesRegex(ValueError,'not configured'):free_review.review_once(self.draft())
            post.assert_not_called()
    def test_one_source_backed_call_without_tools(self):
        with patch.dict(os.environ,{'GROQ_API_KEY':'test'}),patch.object(free_review,'source_excerpt',return_value='Evidence'),patch.object(free_review.requests,'post',return_value=Response()) as post:
            self.assertEqual(free_review.review_once(self.draft()),'FLAGS: 0')
        post.assert_called_once();payload=post.call_args.kwargs['json'];self.assertNotIn('tools',payload);self.assertIn('Evidence',payload['messages'][1]['content'])
    def test_quota_exhaustion_has_no_retry(self):
        with patch.dict(os.environ,{'GROQ_API_KEY':'test'}),patch.object(free_review,'source_excerpt',return_value='Evidence'),patch.object(free_review.requests,'post',return_value=Response(status=429)) as post:
            with self.assertRaisesRegex(ValueError,'HTTP 429'):free_review.review_once(self.draft())
        post.assert_called_once()
    def test_inaccessible_evidence_never_approved(self):
        with patch.dict(os.environ,{'GROQ_API_KEY':'test'}),patch.object(free_review,'source_excerpt',side_effect=ValueError()),patch.object(free_review.requests,'post') as post:
            with self.assertRaisesRegex(ValueError,'inaccessible'):free_review.review_once(self.draft())
        post.assert_not_called()
    def test_concern_is_queued_without_paid_repair(self):
        with patch.object(free_review,'review_once',return_value='FLAGS: 1\n- Unsupported number') as review,patch.object(main,'fit_signal_briefs',side_effect=lambda x:x),patch.object(main,'claude_respond_to_flags') as repair,patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(self.draft(),max_rounds=20)
        review.assert_called_once();repair.assert_not_called();queue.assert_called_once();self.assertEqual(result['unverified_count'],1)
    def test_malformed_reply_rejected(self):
        with patch.dict(os.environ,{'GROQ_API_KEY':'test'}),patch.object(free_review,'source_excerpt',return_value='Evidence'),patch.object(free_review.requests,'post',return_value=Response('{"concerns":"wrong"}')):
            with self.assertRaisesRegex(ValueError,'malformed'):free_review.review_once(self.draft())
    def test_private_source_address_is_blocked(self):
        with patch.object(free_review.socket,'getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]),patch.object(free_review.requests,'get') as get:
            with self.assertRaisesRegex(ValueError,'Non-public'):free_review.source_excerpt('https://example.com')
        get.assert_not_called()
if __name__=='__main__':unittest.main()
