import os
import re
import unittest
from pathlib import Path
from unittest.mock import patch

os.environ.setdefault('ANTHROPIC_API_KEY', 'test-only')

from pipeline import review_page  # noqa: E402

PAGE_ID = '3ee11486-b145-817a-a381-ee7462c339a6'
DB_ID = '35b11486-b145-8059-b742-ca1a114cc221'
SECRET = 'PRIVATE-PROBABILITY-NOTE'
ENV = {'NOTION_API_KEY': 'n', 'NOTION_DATABASE_ID': DB_ID, 'GEMINI_API_KEY': 'g', 'PAGE_ID': PAGE_ID}


def rt(text):
    return [{'plain_text': text}]


def page(parent_db=DB_ID, parent_type='database_id'):
    return {'id': PAGE_ID, 'last_edited_time': '2026-10-03T20:10:00.000Z', 'archived': False,
            'parent': {'type': parent_type, 'database_id': parent_db},
            'properties': {
                'Name': {'title': rt('Title')},
                'Signal Brief': {'rich_text': rt('Brief')},
                'Text 1': {'rich_text': rt('Sources: https://example.com')},
                'Internal Note': {'rich_text': rt(SECRET)},
                'Ready to Post': {'checkbox': False}}}


def block(kind='paragraph', text='Body', children=False):
    return {'type': kind, 'has_children': children, 'last_edited_time': '2026-10-03T20:09:00.000Z',
            kind: {'rich_text': rt(text)}}


class Resp:
    def __init__(self, payload, status=200):
        self.payload, self.status_code = payload, status

    def json(self):
        return self.payload


def fake_get(page_payload=None, blocks=None, status=200):
    def get(url, **kwargs):
        if status != 200:
            return Resp({}, status)
        if '/blocks/' in url:
            return Resp({'results': blocks if blocks is not None else [block('heading_2', 'H'), block()],
                         'has_more': False})
        return Resp(page_payload or page())
    return get


class ReviewTests(unittest.TestCase):
    def run_review(self, review_text, **kwargs):
        with patch('pipeline.review_page.requests.get', side_effect=fake_get(**kwargs)), \
                patch.object(review_page.pipeline_main, 'gemini_review', return_value=review_text) as gem:
            code, result = review_page.run(dict(ENV))
        return code, result, gem

    def test_no_flags_passes_and_private_fields_are_excluded(self):
        code, result, gem = self.run_review('FLAGS: 0')
        self.assertEqual(code, review_page.EXIT_PASSED)
        self.assertEqual(result['status'], 'PASSED')
        sent = gem.call_args[0][0]
        self.assertNotIn(SECRET, sent)
        self.assertNotIn('Internal Note', sent)
        self.assertIn('Sources: https://example.com', sent)
        self.assertIn('## H', sent)
        self.assertEqual(result['ready_to_post'], 'unchecked')
        self.assertTrue(result['page_last_edited'])
        self.assertRegex(result['model'], r'^gemini')

    def test_concerns_are_not_reported_as_passed(self):
        code, result, _ = self.run_review('FLAGS: 1\n- The 31x multiple is unsupported by the stated source.')
        self.assertEqual(code, review_page.EXIT_CONCERNS)
        self.assertNotEqual(result['status'], 'PASSED')
        self.assertEqual(len(result['findings']), 1)

    def test_gemini_failure_is_a_failure(self):
        code, result, _ = self.run_review(None)
        self.assertEqual(code, review_page.EXIT_FAILED)
        self.assertIn('FAILED', result['status'])

    def test_unparseable_or_inconsistent_response_is_a_failure(self):
        for text in ('Looks fine to me', 'FLAGS: 2', 'FLAGS: 0\n- a concern', ''):
            code, result, _ = self.run_review(text)
            self.assertEqual(code, review_page.EXIT_FAILED, text)
            self.assertNotEqual(result['status'], 'PASSED')

    def test_notion_failure_is_a_failure_and_gemini_is_not_called(self):
        code, result, gem = self.run_review('FLAGS: 0', status=404)
        self.assertEqual(code, review_page.EXIT_FAILED)
        gem.assert_not_called()

    def test_unreadable_body_is_a_failure(self):
        for blocks in ([block(), {'type': 'table', 'has_children': True}],
                       [block(children=True)], []):
            code, _, gem = self.run_review('FLAGS: 0', blocks=blocks)
            self.assertEqual(code, review_page.EXIT_FAILED)
            gem.assert_not_called()

    def test_foreign_database_is_refused(self):
        code, result, gem = self.run_review('FLAGS: 0', page_payload=page(parent_db='f' * 32))
        self.assertEqual(code, review_page.EXIT_FAILED)
        gem.assert_not_called()

    def test_missing_settings_and_bad_page_id(self):
        code, _ = review_page.run({})
        self.assertEqual(code, review_page.EXIT_FAILED)
        code, _ = review_page.run(dict(ENV, PAGE_ID='not-an-id'))
        self.assertEqual(code, review_page.EXIT_FAILED)

    def test_script_is_read_only_by_construction(self):
        source = Path(review_page.__file__).read_text()
        for forbidden in ('requests.patch', 'requests.put', 'requests.delete', 'requests.post',
                          'KIT_', 'WHAPI', 'NETLIFY', 'build hook'):
            self.assertNotIn(forbidden, source)
        self.assertEqual(sorted(set(re.findall(r'requests\.(\w+)\(', source))), ['get'])

    def test_workflow_has_no_write_or_send_credentials(self):
        workflow = (Path(review_page.__file__).parent.parent / '.github/workflows/v2-review-page.yml').read_text()
        for forbidden in ('KIT_', 'WHAPI', 'NETLIFY', 'cron:', 'schedule:', 'refresh_publication', 'main.py'):
            self.assertNotIn(forbidden, workflow)
        self.assertIn('workflow_dispatch', workflow)


if __name__ == '__main__':
    unittest.main()
