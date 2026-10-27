import os, unittest, datetime as dt, json
os.environ.setdefault('ANTHROPIC_API_KEY', 'test-only')
from unittest.mock import patch, Mock
from pipeline import recheck_queue as queue
from pipeline import queue_notifications as alerts

class QueueRecoveryTests(unittest.TestCase):
    def page(self):
        return {'id':'draft','created_time':'2026-10-01T00:00:00Z','properties':{
            'Ready to Post':{'checkbox':False},'Internal Note':{'rich_text':[{'plain_text':'V2_UNVERIFIED_SIGNAL:abc\nReview needed'}]}}}
    def test_notifications_never_review_approve_or_delete(self):
        with patch.object(queue,'list_queue',return_value=[self.page()]),patch.object(queue,'notify_private_draft') as alert,patch.object(queue.editor,'DRY_RUN',False),patch.object(queue.editor,'check_editorial_entries') as review,patch.object(queue,'notion') as write:
            result=queue.run()
        alert.assert_called_once();review.assert_not_called();write.assert_not_called()
        self.assertEqual(result['approved'],0);self.assertEqual(result['discarded'],0)
    def test_dry_run_suppresses_alert(self):
        with patch.object(queue,'list_queue',return_value=[self.page()]),patch.object(queue,'notify_private_draft') as alert,patch.object(queue.editor,'DRY_RUN',True):queue.run()
        alert.assert_not_called()
    def test_alert_failure_is_visible_without_changing_draft(self):
        with patch.object(queue,'list_queue',return_value=[self.page()]),patch.object(queue,'notify_private_draft',side_effect=RuntimeError),patch.object(queue.editor,'DRY_RUN',False),patch.object(queue,'notion') as write:
            with self.assertRaises(RuntimeError):queue.run()
        write.assert_not_called()

class QueueAlertTests(unittest.TestCase):
    def test_recipient_is_verified_connected_account(self):
        response=Mock(status_code=200);response.json.return_value={'user':{'id':'971500000000@s.whatsapp.net'}}
        with patch.dict(os.environ,{'WHAPI_TOKEN':'test-only'}),patch.object(alerts.requests,'get',return_value=response):
            recipient,headers=alerts.connected_account()
        self.assertEqual(recipient,'971500000000@s.whatsapp.net')

    def test_missing_connected_number_fails_closed(self):
        response=Mock(status_code=200);response.json.return_value={'user':{}}
        with patch.dict(os.environ,{'WHAPI_TOKEN':'test-only'}),patch.object(alerts.requests,'get',return_value=response):
            with self.assertRaises(RuntimeError):alerts.connected_account()

    def test_duplicate_send_claim_is_not_resent(self):
        with patch.object(alerts,'connected_account') as account,patch.object(alerts.requests,'post') as send:
            self.assertFalse(alerts.notify_private_draft('id',{},'note\nV2_QUEUE_ALERT:pending',{}))
        account.assert_not_called();send.assert_not_called()

    def test_unaccepted_send_is_visible(self):
        response=Mock(status_code=200);response.json.return_value={'sent':False}
        with patch.object(alerts.requests,'post',return_value=response):
            with self.assertRaises(RuntimeError):alerts.send_self_alert('test',('971500000000@s.whatsapp.net',{}))

    def test_dry_run_alert_never_sends(self):
        with patch.object(alerts,'connected_account') as account:
            alerts.notify_private_draft('id',{},'notes',{},dry_run=True)
        account.assert_not_called()

    def test_accepted_notification_retains_receipt(self):
        def response(note):
            r=Mock(status_code=200)
            r.json.return_value={'properties':{'Ready to Post':{'checkbox':False},'Internal Note':{'rich_text':[{'plain_text':note}]}}}
            return r
        note='V2_UNVERIFIED_SIGNAL:abc\nReason'
        with patch.object(alerts,'connected_account',return_value=('971500000000@s.whatsapp.net',{})),patch.object(alerts.requests,'get',side_effect=[response(note),response(note+'\nV2_QUEUE_ALERT:pending')]),patch.object(alerts.requests,'patch',return_value=Mock(status_code=200)) as save,patch.object(alerts,'send_self_alert',return_value='receipt-id') as send:
            self.assertTrue(alerts.notify_private_draft('id',{'title':'Draft','desk':'UAE'},note,{}))
        send.assert_called_once()
        chunks=save.call_args.kwargs['json']['properties']['Internal Note']['rich_text']
        self.assertIn('V2_QUEUE_ALERT:accepted:receipt-id',''.join(x['text']['content'] for x in chunks))
