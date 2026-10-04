import unittest
from unittest.mock import patch
import contextlib
import io
import refresh_publication as refresh

class RefreshTests(unittest.TestCase):
    def wait(self, responses, ticks, timeout=600):
        with patch.object(refresh.time, "monotonic", side_effect=ticks), patch.object(refresh.time, "sleep"), patch.object(refresh, "request", side_effect=responses):
            refresh.wait_for_publication([{"id": "story", "digest": "new"}], timeout_seconds=timeout)

    def test_success_after_old_four_minute_limit(self):
        self.wait([{"version": 1, "entries": []}, {"version": 1, "entries": [{"id": "story", "digest": "new"}]}], [0, 0, 0, 300, 300])

    def test_transient_network_error_then_success(self):
        self.wait([OSError("secret-url"), {"version": 1, "entries": [{"id": "story", "digest": "new"}]}], [0, 0, 0, 20, 20])

    def test_timeout_remains_failure(self):
        with self.assertRaisesRegex(refresh.PublicationTimeout, "Do not rerun desk research"):
            self.wait([{"version": 1, "entries": []}], [0, 0, 0, 601])

    def test_timeout_reports_unavailable_endpoint_without_leaking(self):
        output = io.StringIO()
        with contextlib.redirect_stdout(output):
            with self.assertRaises(refresh.PublicationTimeout) as raised:
                self.wait([OSError("https://secret")], [0, 0, 0, 601])
        self.assertIn("OSError", str(raised.exception))
        self.assertNotIn("https://secret", output.getvalue() + str(raised.exception))

    def test_generic_error_does_not_leak_secrets(self):
        output = io.StringIO()
        with contextlib.redirect_stderr(output):
            refresh.report_failure(ValueError("secret-hook-url"))
        self.assertIn("ValueError", output.getvalue())
        self.assertNotIn("secret-hook-url", output.getvalue())

    def test_unchanged_content_never_builds(self):
        with patch.object(refresh, "fetch_entries", return_value=[]), patch.object(refresh, "request", return_value={"version": 1, "entries": []}), patch.object(refresh.urllib.request, "urlopen") as hook:
            refresh.main()
            hook.assert_not_called()

    def test_dry_run_never_builds(self):
        with patch.object(refresh, "fetch_entries", return_value=[{"id": "new"}]), patch.object(refresh, "request", return_value={"version": 1, "entries": []}), patch.dict(refresh.os.environ, {"DRY_RUN": "true"}), patch.object(refresh.urllib.request, "urlopen") as hook:
            refresh.main()
            hook.assert_not_called()

if __name__ == "__main__":
    unittest.main()
