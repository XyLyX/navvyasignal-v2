"""Verify delivery content without credentials, network or provider clients."""
import ast
import html
from pathlib import Path
import unittest

source = ast.parse(Path(__file__).with_name('main.py').read_text())
names = {'daily_brief_entries', 'assemble_daily_send'}
module = ast.Module(body=[node for node in source.body if isinstance(node, ast.FunctionDef) and node.name in names], type_ignores=[])
namespace = {'html': html, 'DESKS': ['UAE Desk', 'India Desk']}
exec(compile(module, 'delivery-functions', 'exec'), namespace)


class DailyBriefSelectionTests(unittest.TestCase):
    def test_email_and_channel_exclude_unselected_feed_entries(self):
        entries = [{'id': 'chosen', 'title': 'Chosen signal', 'desk': 'UAE Desk', 'body': 'Approved facts',
                    'sources': 'https://example.com/chosen', 'homepage_priority': 1},
                   {'id': 'other', 'title': 'Unselected signal', 'desk': 'India Desk', 'body': 'Other facts',
                    'sources': 'https://example.com/other', 'homepage_priority': 0}]
        selected = namespace['daily_brief_entries'](entries)
        brief = namespace['assemble_daily_send'](selected, '2026-10-09')
        for field in ['email_html', 'whatsapp_text']:
            self.assertIn('Chosen signal', brief[field])
            self.assertNotIn('Unselected signal', brief[field])

    def test_no_selection_cannot_fall_back_to_the_whole_feed(self):
        self.assertEqual(namespace['daily_brief_entries']([{'id': 'other', 'homepage_priority': 0}]), [])

    def test_same_order_and_seven_story_limit(self):
        entries = [{'id': str(i), 'homepage_priority': i+1} for i in reversed(range(10))]
        self.assertEqual([e['id'] for e in namespace['daily_brief_entries'](entries)], list(map(str, range(7))))
