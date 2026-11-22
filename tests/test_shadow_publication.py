import copy
import datetime as dt
import unittest
from uuid import UUID

from pipeline.shadow_publication import SOURCE, parity, revision


class ShadowPublicationTests(unittest.TestCase):
    edition = dt.date(2026, 11, 22)
    page_id = UUID("094f47dc-89b2-4ccd-9f5b-bc42fb5510de")

    def setUp(self):
        def prop(kind, value):
            return {"type": kind, kind: value}

        self.page = {
            "id": str(self.page_id), "archived": False, "created_time": "2026-11-22T00:00:00Z",
            "parent": {"data_source_id": SOURCE},
            "properties": {
                "Name": prop("title", [{"plain_text": "Headline"}]),
                "Signal Brief": prop("rich_text", [{"plain_text": "Brief"}]),
                "Text 1": prop("rich_text", [{"plain_text": "Sources"}]),
                "Content Type": prop("select", {"name": "Signal"}),
                "Ready to Post": prop("checkbox", True),
                "Internal Note": prop("rich_text", [
                    {"plain_text": 'V2_RELEASED:{"edition":"2026-11-22"}'}
                ]),
            },
        }

    def test_determinism_and_changed_revision(self):
        _, original = revision(self.page, self.page_id, self.edition)
        changed = copy.deepcopy(self.page)
        changed["properties"]["Signal Brief"]["rich_text"][0]["plain_text"] = "Edited"
        self.assertEqual(original, revision(self.page, self.page_id, self.edition)[1])
        self.assertNotEqual(original, revision(changed, self.page_id, self.edition)[1])

    def test_unapproved_or_wrong_edition_is_rejected(self):
        with self.assertRaises(ValueError):
            revision(self.page, self.page_id, dt.date(2026, 11, 23))
        self.page["properties"]["Ready to Post"]["checkbox"] = False
        with self.assertRaises(ValueError):
            revision(self.page, self.page_id, self.edition)

    def test_foreign_source_is_rejected(self):
        self.page["parent"]["data_source_id"] = str(self.page_id)
        with self.assertRaises(ValueError):
            revision(self.page, self.page_id, self.edition)

    def test_parity(self):
        record, _ = revision(self.page, self.page_id, self.edition)
        live = {"version": 1, "entries": [{"id": record["page_id"], "digest": record["public_digest"]}]}
        self.assertEqual([], parity([record], live))
        live["entries"][0]["digest"] = "unmatched"
        self.assertEqual([record["page_id"]], parity([record], live))
        live["entries"].append(live["entries"][0])
        with self.assertRaises(ValueError):
            parity([record], live)


if __name__ == "__main__":
    unittest.main()
