"""Offline fail-closed publication retry tests. No Notion or Netlify calls."""
import unittest
from unittest.mock import Mock, patch
from pipeline import regional_release as release
from pipeline import refresh_publication as refresh

SNAPSHOT = [{"id":"approved-fixture","digest":"abc"}]

class RetryGuardTests(unittest.TestCase):
    def setUp(self):
        self.api=Mock()
        self.ledger={"id":"fixture-ledger"}
        self.live={"version":1,"entries":[]}
        self.env=patch.dict("os.environ",{"V2_NETLIFY_BUILD_HOOK":"https://api.netlify.com/build_hooks/fixture123"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def invoke(self,state,hook=None,live=None):
        hook=hook or Mock()
        response=Mock(status=202)
        response.__enter__=Mock(return_value=response)
        response.__exit__=Mock(return_value=False)
        hook.return_value=response
        with patch.object(refresh,"fetch_entries",return_value=SNAPSHOT),patch.object(refresh,"request",return_value=self.live if live is None else live),patch.object(refresh,"wait_for_publication"),patch("urllib.request.urlopen",hook):
            release.publish_once(self.api,self.ledger,state)
        return hook

    def test_retry_after_accepted_build_does_not_request_another(self):
        state={"phase":"build_requested","fingerprint":release.hashlib.sha256(release.json.dumps(SNAPSHOT,sort_keys=True).encode()).hexdigest()}
        hook=self.invoke(state)
        hook.assert_not_called()
        self.assertEqual(state["phase"],"verified")

    def test_unknown_build_receipt_fails_closed_on_changed_snapshot(self):
        state={"phase":"build_requested","fingerprint":"different"}
        with self.assertRaisesRegex(RuntimeError,"Content changed"):
            self.invoke(state)

    def test_invalid_production_snapshot_cannot_build(self):
        state={"phase":"staging"}
        with self.assertRaisesRegex(RuntimeError,"Invalid production snapshot"):
            self.invoke(state,live={"version":2,"entries":[]})
        self.api.save_ledger.assert_not_called()

    def test_already_verified_content_no_build(self):
        state={"phase":"verified"}
        hook=self.invoke(state,live={"version":1,"entries":SNAPSHOT})
        hook.assert_not_called()

    def test_build_claim_saved_before_external_request(self):
        state={"phase":"staging"}
        events=[]
        self.api.save_ledger.side_effect=lambda *_:events.append("persist")
        response=Mock(status=202)
        response.__enter__=Mock(return_value=response)
        response.__exit__=Mock(return_value=False)
        hook=Mock(side_effect=lambda *_args,**_kwargs:(events.append("hook"),response)[1])
        self.invoke(state,hook=hook)
        self.assertEqual(events[0:2],["persist","hook"])

if __name__=="__main__":
    unittest.main()
