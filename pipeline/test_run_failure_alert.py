import os
import unittest
from unittest.mock import patch
from pipeline import notify_run_failure as alert


class FailureAlertTests(unittest.TestCase):
    def test_dry_run_never_sends(self):
        with patch.dict(os.environ,{'DRY_RUN':'true'}),patch.object(alert,'send_self_alert') as send:
            alert.run()
        send.assert_not_called()

    def test_alert_targets_existing_connected_account_with_run_link(self):
        with patch.dict(os.environ,{'DRY_RUN':'false','GITHUB_REPOSITORY':'XyLyX/navvyasignal-v2','GITHUB_RUN_ID':'123','GITHUB_WORKFLOW':'Release'}),patch.object(alert,'send_self_alert') as send:
            alert.run()
        self.assertIn('https://github.com/XyLyX/navvyasignal-v2/actions/runs/123',send.call_args.args[0])
