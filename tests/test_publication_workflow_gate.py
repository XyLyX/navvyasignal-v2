"""Guard every workflow capable of invoking a production publication."""
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
WORKFLOWS = [
    "v2-notion-refresh.yml",
    "v2-daily-release.yml",
    "v2-site-code-publish.yml",
    "v2-static-refresh.yml",
    "v2-manual-current-edition.yml",
    "v2-editorial-action.yml",
]

class PublicationWorkflowGateTests(unittest.TestCase):
    def test_every_publication_entrypoint_has_fenced_lease(self):
        for name in WORKFLOWS:
            with self.subTest(workflow=name):
                content = (ROOT / ".github" / "workflows" / name).read_text()
                self.assertIn("PUBLICATION_LEASE_REQUIRED: ${{ vars.PUBLICATION_LEASE_REQUIRED }}", content)
                self.assertIn("PUBLICATION_DATABASE_URL: ${{ secrets.PUBLICATION_DATABASE_URL }}", content)
                self.assertIn("psycopg[binary]", content)

if __name__ == "__main__":
    unittest.main()
