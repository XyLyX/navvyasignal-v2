import os, unittest, datetime as dt, json
os.environ.setdefault('ANTHROPIC_API_KEY', 'test-only')
from unittest.mock import patch, Mock
from pipeline import recheck_queue as queue
from pipeline import queue_notifications as alerts

class QueueRecoveryTests(unittest.TestCase):
    def page(self):
        return {'id':'draft-id','created_time':'2026-10-01T00:00:00Z','last_edited_time':'v1',
            'properties':{'Ready to Post':{'checkbox':False},'Category':{'select':{'name':'UAE Desk'}},
                'Name':{'title':[{'plain_text':'Draft'}]},'Signal Brief':{'rich_text':[{'plain_text':'Facts.\n\nConsequences.'}]},
                'Text 1':{'rich_text':[{'plain_text':'https://example.com/report'}]},
                'Internal Note':{'rich_text':[{'plain_text':'V2_UNVERIFIED_SIGNAL:abc\nNeeds review'}]}}}

    def test_interval_and_attempt_cap(self):
        now=dt.datetime(2026,10,9,tzinfo=queue.UTC)
        s={'attempts':0,'last_attempt':(now-dt.timedelta(minutes=59)).isoformat()}
        self.assertFalse(queue.due(s,now))
        s['last_attempt']=(now-dt.timedelta(hours=1)).isoformat();self.assertTrue(queue.due(s,now))
        s['attempts']=2;self.assertFalse(queue.due(s,now))
        s['attempts']='0';self.assertFalse(queue.due(s,now))

    def test_changed_content_gets_new_retry_budget(self):
        p=self.page();e=queue.draft(p)
        note=queue.note_with_state(queue.text(p,'Internal Note'),{'fingerprint':queue.fingerprint(e),'attempts':2,'last_attempt':p['created_time']})
        p['properties']['Internal Note']['rich_text']=[{'plain_text':note}]
        self.assertEqual(queue.state(p,e)['attempts'],2)
        e['body_markdown']='New content';self.assertEqual(queue.state(p,e)['attempts'],0)

    def test_manual_approval_cancels_recovery_write(self):
        p=self.page();current=self.page();current['properties']['Ready to Post']['checkbox']=True
        with patch.object(queue,'notion',return_value=current) as notion:
            with self.assertRaisesRegex(RuntimeError,'changed'):queue.write_note(p,'note')
        notion.assert_called_once()

    def test_manual_edit_cancels_recovery_write(self):
        p=self.page();current=self.page();current['last_edited_time']='v2'
        with patch.object(queue,'notion',return_value=current) as notion:
            with self.assertRaises(RuntimeError):queue.write_note(p,'note')
        notion.assert_called_once()

    def test_approval_updates_same_queue_page(self):
        p=self.page();e=queue.draft(p)
        approved={'notion_entries':[e],'editorial_decision':{'ready_to_post':True}}
        with patch.object(queue,'list_queue',return_value=[p]),patch.object(queue,'notion',return_value=p),patch.object(queue,'notify_private_draft'),patch.object(queue,'write_note',return_value=p) as save,patch.object(queue.editor,'DRY_RUN',False),patch.object(queue.editor,'_claude_final_recovery',return_value=approved),patch.object(queue.editor,'mark_publication_changed') as changed:
            totals=queue.run()
        self.assertEqual(totals['approved'],1);self.assertEqual(save.call_count,2)
        self.assertTrue(save.call_args.args[2]['Ready to Post']['checkbox']);changed.assert_called_once()

    def test_final_rejection_trashes_only_current_private_page(self):
        p=self.page()
        with patch.object(queue,'list_queue',return_value=[p]),patch.object(queue,'notion',return_value=p) as notion,patch.object(queue,'notify_private_draft'),patch.object(queue,'write_note',return_value=p),patch.object(queue.editor,'DRY_RUN',False),patch.object(queue.editor,'_claude_final_recovery',side_effect=queue.editor.FinalEditorialRejection(queue.draft(p),'Reject')):
            totals=queue.run()
        self.assertEqual(totals['discarded'],1)
        self.assertEqual(notion.call_args.args,('/pages/draft-id','PATCH',{'archived':True}))

    def test_provider_failure_persists_attempt_and_remains_private(self):
        p=self.page()
        with patch.object(queue,'list_queue',return_value=[p]),patch.object(queue,'notion',return_value=p),patch.object(queue,'notify_private_draft'),patch.object(queue,'write_note',return_value=p) as save,patch.object(queue.editor,'DRY_RUN',False),patch.object(queue.editor,'_claude_final_recovery',side_effect=TimeoutError()):
            totals=queue.run()
        self.assertEqual(totals['held'],1)
        self.assertIn('"attempts":1',save.call_args.args[1]);self.assertNotIn('Ready to Post',save.call_args.kwargs)

    def test_dry_run_makes_no_paid_call_or_write(self):
        with patch.object(queue,'list_queue',return_value=[self.page()]),patch.object(queue.editor,'DRY_RUN',True),patch.object(queue.editor,'_claude_final_recovery') as review,patch.object(queue,'notify_private_draft') as alert,patch.object(queue,'write_note') as save:
            queue.run()
        review.assert_not_called();alert.assert_not_called();save.assert_not_called()

    def test_pagination(self):
        with patch.object(queue,'notion',side_effect=[{'results':[self.page()],'has_more':True,'next_cursor':'next'},{'results':[],'has_more':False}]) as notion:
            self.assertEqual(len(queue.list_queue()),1)
        self.assertEqual(notion.call_args.args[2]['start_cursor'],'next')

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
