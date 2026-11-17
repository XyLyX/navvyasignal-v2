import datetime as dt
import unittest
from unittest.mock import patch
from pipeline import code_deploy_receipt as receipt

class TestDeployReceipt(unittest.TestCase):
    def test_only_fresh_published_production_commit_is_accepted(self):
        now=dt.datetime(2026,11,18,tzinfo=dt.timezone.utc)
        before={"old"}
        values=[
          {"id":"old","context":"production","commit_ref":"a"*40,"state":"ready","published_at":"2026-11-18T00:01:00Z"},
          {"id":"preview","context":"deploy-preview","commit_ref":"a"*40,"state":"ready","published_at":"2026-11-18T00:01:00Z"},
          {"id":"pending","context":"production","commit_ref":"a"*40,"state":"building","published_at":None},
          {"id":"wrong","context":"production","commit_ref":"b"*40,"state":"ready","published_at":"2026-11-18T00:01:00Z"},
          {"id":"correct","context":"production","commit_ref":"a"*40,"state":"ready","published_at":"2026-11-18T00:01:00Z"},
        ]
        with patch.object(receipt,"deployments",return_value=values):
            self.assertEqual(receipt.verify("a"*40,before,now,timeout=1),"correct")
    def test_missing_or_unverified_deploy_fails_closed(self):
        now=dt.datetime(2026,11,18,tzinfo=dt.timezone.utc)
        with patch.object(receipt,"deployments",return_value=[]):
            with self.assertRaisesRegex(RuntimeError,"not verified"):
                receipt.verify("a"*40,set(),now,timeout=0)
if __name__=="__main__":
    unittest.main()
