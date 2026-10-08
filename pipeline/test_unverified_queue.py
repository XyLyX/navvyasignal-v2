import os
os.environ.setdefault('ANTHROPIC_API_KEY', 'test-placeholder')
import unittest
from unittest.mock import patch
from pipeline import main

class Response:
    def __init__(self, data, status=200): self.data=data; self.status_code=status
    def json(self): return self.data

class QueueTests(unittest.TestCase):
    def setUp(self):
        # Failed recovery is mocked: these tests exercise private queue storage.
        recovery = patch.object(main, 'claude_respond_to_flags', return_value=None)
        self.recovery = recovery.start()
        self.addCleanup(recovery.stop)

    def draft(self, title='Draft'):
        return {'title':title,'desk':'West Asia Desk','desk_ambiguous':False,'body_markdown':'Facts.\n\nConsequences.', 'sources_text':'https://example.com/report'}

    def test_rejected_story_does_not_block_approved_story(self):
        draft={'notion_entries':[self.draft('Held'),self.draft('Approved')]}
        with patch.object(main,'fit_signal_briefs',side_effect=lambda x:x), patch.object(main,'_verify_single_signal',side_effect=[None,{'notion_entries':[self.draft('Approved')]}]), patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop(draft)
        self.assertEqual([e['title'] for e in result['notion_entries']],['Approved'])
        self.assertEqual(result['unverified_count'],1);queue.assert_called_once()

    def test_all_rejected_is_successful_private_hold(self):
        with patch.object(main,'fit_signal_briefs',side_effect=lambda x:x), patch.object(main,'_verify_single_signal',return_value=None), patch.object(main,'save_unverified_signal'):
            result=main.verify_with_gemini_loop({'notion_entries':[self.draft()]})
        self.assertEqual(result['notion_entries'],[]);self.assertEqual(result['unverified_count'],1)

    def test_provider_error_preserves_draft_and_other_approved_result(self):
        with patch.object(main,'fit_signal_briefs',side_effect=lambda x:x), patch.object(main,'_verify_single_signal',side_effect=[RuntimeError('provider unavailable'),{'notion_entries':[self.draft('Approved')]}]), patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop({'notion_entries':[self.draft(),self.draft('Approved')]})
        self.assertEqual(len(result['notion_entries']),1);queue.assert_called_once()

    def test_missing_source_recovery_failure_stays_queued(self):
        draft=self.draft();draft['sources_text']='No direct link'
        with patch.object(main,'_verify_single_signal') as review, patch.object(main,'save_unverified_signal') as queue:
            result=main.verify_with_gemini_loop({'notion_entries':[draft]})
        review.assert_not_called();queue.assert_called_once();self.assertEqual(result['unverified_count'],1)

    def test_queue_write_is_private_and_preserves_published_update(self):
        draft=self.draft();draft.update(action='update',existing_id='published-id')
        with patch.object(main,'DRY_RUN',False), patch.object(main.requests,'post',side_effect=[Response({'results':[]}),Response({'id':'new-draft'})]) as post, patch.object(main.requests,'patch') as update, patch.object(main,'mark_publication_changed') as marker:
            self.assertEqual(main.save_unverified_signal(draft,'FLAGS: 1\n- Concern'),'new-draft')
        props=post.call_args_list[1].kwargs['json']['properties']
        self.assertFalse(props['Ready to Post']['checkbox']);self.assertFalse(props["Today's Intelligence"]['checkbox'])
        self.assertEqual(props['Category']['select']['name'],'West Asia Desk')
        self.assertTrue(props['Internal Note']['rich_text'][0]['text']['content'].startswith('V2_UNVERIFIED_SIGNAL:'))
        update.assert_not_called();marker.assert_not_called()

    def test_idempotent_private_draft_does_not_write_twice(self):
        with patch.object(main,'DRY_RUN',False),patch.object(main.requests,'post',return_value=Response({'results':[{'id':'existing-draft'}]})) as post:
            self.assertEqual(main.save_unverified_signal(self.draft(),'concern'),'existing-draft')
        self.assertEqual(post.call_count,1)

    def test_storage_failure_remains_visible(self):
        with patch.object(main,'DRY_RUN',False),patch.object(main.requests,'post',return_value=Response({},503)):
            with self.assertRaisesRegex(RuntimeError,'Private queue lookup failed'):
                main.save_unverified_signal(self.draft(),'concern')

    def test_chunking_preserves_full_long_draft(self):
        text='x'*6500;chunks=main._rich_text_chunks(text)
        self.assertEqual(''.join(c['text']['content'] for c in chunks),text)
        self.assertTrue(all(len(c['text']['content'])<=1900 for c in chunks))

    def test_dry_run_never_writes_queue(self):
        with patch.object(main,'DRY_RUN',True),patch.object(main.requests,'post') as post:
            main.save_unverified_signal(self.draft(),'concern')
        post.assert_not_called()

if __name__=='__main__': unittest.main()
