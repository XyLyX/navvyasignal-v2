import os, unittest
os.environ.setdefault('ANTHROPIC_API_KEY','test-only')
from unittest.mock import patch
from pipeline import main

class SynthesisPolicyTests(unittest.TestCase):
    def test_week_fetches_all_seven_dates(self):
        with patch.dict(os.environ, {'V2_EDITION_DATE':'2026-10-04'}), patch.object(main,'fetch_todays_entries_for_compile',side_effect=lambda date:[{'date':date}]) as fetch:
            rows=main.fetch_week_entries_for_synthesis()
        self.assertEqual(len(rows),7)
        self.assertEqual([c.args[0] for c in fetch.call_args_list],['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04'])
    def test_held_special_never_written(self):
        with patch.object(main,'check_editorial_entries',return_value={'notion_entries':[]}),patch.object(main,'write_special_entry') as writer:
            self.assertIsNone(main.write_verified_special_entry('Draft','Body','https://example.com/report','Briefing'))
        writer.assert_not_called()
    def test_special_uses_reviewed_wording_and_identity(self):
        approved={'title':'Checked','body_markdown':'Checked body','sources_text':'https://example.com/checked'}
        with patch.object(main,'check_editorial_entries',return_value={'notion_entries':[approved]}) as review,patch.object(main,'write_special_entry',return_value='page') as writer:
            self.assertEqual(main.write_verified_special_entry('Draft','Body','https://example.com/report','Cross-Desk',primary_desk=main.DESKS[1],existing_id='existing'),'page')
        self.assertEqual(review.call_args.args[0]['notion_entries'][0]['existing_id'],'existing')
        self.assertEqual(writer.call_args.args[:3],('Checked','Checked body','https://example.com/checked'))
    def test_retired_homepage_entrypoint_cannot_publish(self):
        with patch.object(main,'RUN_TYPE','site_only'),patch.object(main,'NOTION_API_KEY','test'),patch.object(main,'NOTION_DATABASE_ID','db'),patch.object(main,'fail_hard',side_effect=lambda msg: (_ for _ in ()).throw(RuntimeError(msg))):
            with self.assertRaisesRegex(RuntimeError,'Retired'):main.main()
