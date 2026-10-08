import io
import json
import unittest
from urllib.error import HTTPError, URLError
from unittest.mock import Mock
from pipeline.scheduler_ownership import check_ownership, OwnershipUnavailable

def reply(active):
    return io.StringIO(json.dumps({"version":1,"active":active}))

def http(code, body=b""):
    return HTTPError("https://example.test", code, "Unavailable", {}, io.BytesIO(body))

class OwnershipTests(unittest.TestCase):
    def test_active(self):
        self.assertTrue(check_ownership("url", Mock(return_value=reply(True))))
    def test_inactive(self):
        self.assertFalse(check_ownership("url", Mock(return_value=reply(False))))
    def test_transient_recovers(self):
        opener=Mock(side_effect=[http(503), URLError("timeout"),reply(True)])
        sleep=Mock()
        self.assertTrue(check_ownership("url",opener,sleep))
        self.assertEqual(sleep.call_count,2)
    def test_outage_never_falls_back(self):
        opener=Mock(side_effect=[http(503) for _ in range(4)])
        with self.assertRaises(OwnershipUnavailable):
            check_ownership("url",opener,Mock())
        self.assertEqual(opener.call_count,4)
    def test_billing_no_retry(self):
        opener=Mock(side_effect=http(503,b'{"error":"usage_exceeded"}'))
        sleep=Mock()
        with self.assertRaisesRegex(OwnershipUnavailable,"hosting usage limit"):
            check_ownership("url",opener,sleep)
        sleep.assert_not_called()
    def test_404_not_permission_to_run(self):
        with self.assertRaises(OwnershipUnavailable):
            check_ownership("url",Mock(side_effect=http(404)),Mock())
    def test_invalid_status(self):
        with self.assertRaises(OwnershipUnavailable):
            check_ownership("url",Mock(return_value=io.StringIO('{"version":1,"active":"true"}')))
    def test_invalid_json(self):
        with self.assertRaises(OwnershipUnavailable):
            check_ownership("url",Mock(return_value=io.StringIO('not json')))

if __name__=="__main__":
    unittest.main()
