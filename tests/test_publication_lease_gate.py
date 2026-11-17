import os
import unittest
from unittest.mock import patch
from pipeline import publication_lease_gate as gate

class GateTests(unittest.TestCase):
    def test_disabled_does_not_touch_database(self):
        with patch.dict(os.environ,{'PUBLICATION_LEASE_REQUIRED':'false'}):
            with patch.object(gate,'connect',side_effect=AssertionError('db touched')):
                self.assertEqual(gate.claim('a'*64),(None,None))
    def test_enabled_without_secret_blocks(self):
        with patch.dict(os.environ,{'PUBLICATION_LEASE_REQUIRED':'true','PUBLICATION_DATABASE_URL':''}):
            with self.assertRaises(RuntimeError):
                gate.connect()
    def test_shared_resource(self):
        self.assertEqual(gate.RESOURCE,'navvyasignal/v2/production-build')
    def test_code_fingerprint_is_deterministic(self):
        self.assertEqual(gate.code_fingerprint('a'*40,'2026-11-18T00:00:00Z'),gate.code_fingerprint('a'*40,'2026-11-18T00:00:00Z'))
if __name__=='__main__':unittest.main()
