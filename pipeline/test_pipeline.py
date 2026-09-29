import unittest
from unittest.mock import patch

from pipeline import main


class Response:
    status_code = 200
    text = ''

    def __init__(self, payload=None):
        self.payload = payload or {}

    def json(self):
        return self.payload


def page(identifier, created, kind='Signal', ready=True):
    return {'id': identifier, 'created_time': created, 'properties': {
        'Name': {'title': [{'plain_text': identifier}]},
        'Category': {'select': {'name': 'West Asia Desk'}},
        'Content Type': {'select': {'name': kind}},
        'Ready to Post': {'checkbox': ready},
        'Signal Brief': {'rich_text': [{'plain_text': 'brief'}]},
        'Text 1': {'rich_text': [{'plain_text': 'source'}]},
    }}


class PipelineTests(unittest.TestCase):
    def test_repeated_fact_concern_never_reaches_notion(self):
        draft = {'notion_entries': [{'title': 'Disputed claim'}]}
        with patch.object(main, 'gemini_review', side_effect=[
                'FLAGS: 1\n- Officeholder is wrong',
                'FLAGS: 1\n- Officeholder is wrong']), \
                patch.object(main, 'claude_respond_to_flags', return_value=draft), \
                patch.object(main, 'push_to_notion') as publish:
            with self.assertRaises(SystemExit):
                reviewed = main.verify_with_gemini_loop(draft)
                main.push_to_notion(reviewed, set())
        publish.assert_not_called()

    def test_fact_review_rejects_missing_count_and_provider_failure(self):
        for response in ('No concerns', None):
            with self.subTest(response=response), \
                    patch.object(main, 'gemini_review', return_value=response):
                with self.assertRaises(SystemExit):
                    main.verify_with_gemini_loop({'notion_entries': []})

    def test_compilation_reads_all_pages_and_excludes_previous_dubai_day(self):
        seen = []

        def request(url, headers, json, timeout):
            seen.append(json)
            if len(seen) == 1:
                return Response({'results': [page('one', '2026-09-26T20:01:00Z'),
                                             page('old', '2026-09-26T19:59:00Z')],
                                 'has_more': True, 'next_cursor': 'cursor-2'})
            return Response({'results': [page('two', '2026-09-27T02:00:00Z'),
                                         page('briefing', '2026-09-27T03:00:00Z', 'Briefing'),
                                         page('draft', '2026-09-27T04:00:00Z', ready=False)],
                             'has_more': False, 'next_cursor': None})

        with patch.object(main, 'dubai_today', return_value='2026-09-27'), \
                patch.object(main.requests, 'post', side_effect=request):
            entries = main.fetch_todays_entries_for_compile()
        self.assertEqual({e['id'] for e in entries}, {'one', 'two'})
        self.assertEqual(seen[1]['start_cursor'], 'cursor-2')
        self.assertEqual(seen[0]['filter']['created_time']['on_or_after'], '2026-09-26T20:00:00Z')

    def test_homepage_writes_date_and_priority_and_checks_failures(self):
        ids = ['a', 'b', 'c']
        entries = [{'id': i, 'title': i, 'desk': 'West Asia Desk', 'body': 'body'} for i in ids]
        calls = []

        def write(url, headers, json, timeout):
            calls.append((url.rsplit('/', 1)[-1], json['properties']))
            return Response()

        class Message:
            content = [type('Block', (), {'type': 'text', 'text': '{"selected_ids":["c","a","a"]}'})()]

        class Stream:
            def __enter__(self): return self
            def __exit__(self, *args): return None
            def get_final_message(self): return Message()

        with patch.object(main, 'dubai_today', return_value='2026-09-27'), \
                patch.object(main.requests, 'patch', side_effect=write), \
                patch.object(main.client.messages, 'stream', return_value=Stream()), \
                patch.object(main, 'DRY_RUN', False):
            self.assertEqual(main.select_todays_intelligence(entries), ['c', 'a'])
        self.assertEqual(len(calls), 5)
        self.assertEqual(calls[-2][1]['Homepage Priority']['number'], 1)
        self.assertEqual(calls[-1][1]['Homepage Priority']['number'], 2)
        self.assertEqual(calls[-1][1]['Homepage Date']['date']['start'], '2026-09-27')

    def test_editorial_batch_rejects_unlinked_or_truncated_story_before_writing(self):
        good = {'action': 'create', 'title': 'Verified development',
                'desk': 'West Asia Desk', 'body_markdown': 'Complete brief.',
                'sources_text': 'Agency: https://agency.example/story'}
        bad = {**good, 'title': 'Unlinked development',
               'sources_text': 'Sources: several news sites'}
        with patch.object(main.requests, 'post') as post, \
                patch.object(main, 'fail_hard', side_effect=ValueError):
            with self.assertRaises(ValueError):
                main.push_to_notion([good, bad], set())
            post.assert_not_called()
            with self.assertRaises(ValueError):
                main.push_to_notion([{**good, 'body_markdown': 'x' * 1801}], set())
            post.assert_not_called()

    def test_signal_brief_fits_one_notion_block(self):
        body = 'What happened. ' * 45 + '\n\nWhy it matters. ' * 30
        entry = {'action': 'create', 'title': 'Verified development',
                 'desk': 'West Asia Desk', 'body_markdown': body,
                 'sources_text': 'Agency: https://agency.example/story'}
        with patch.object(main, 'DRY_RUN', False), \
                patch.object(main.requests, 'post', return_value=Response()) as post:
            main.push_to_notion([entry], set())
        blocks = post.call_args.kwargs['json']['properties']['Signal Brief']['rich_text']
        self.assertEqual(len(blocks), 1)
        self.assertEqual(blocks[0]['text']['content'], body)

    def test_overlong_signal_is_rewritten_before_review(self):
        entry = {'title': 'A development', 'body_markdown': 'A' * 2000,
                 'sources_text': 'Reuters: https://example.com/report'}
        class Stream:
            def __enter__(self): return self
            def __exit__(self, *args): return None
            def get_final_message(self):
                return type('Message', (), {'content': [type('Block', (), {
                    'type': 'text', 'text': 'A factual paragraph.\n\nWhy this matters.'})()]})()
        with patch.object(main.client.messages, 'stream', return_value=Stream()):
            draft = main.fit_signal_briefs({'notion_entries': [entry]})
        self.assertEqual(draft['notion_entries'][0]['body_markdown'],
                         'A factual paragraph.\n\nWhy this matters.')

    def test_short_unstructured_signal_is_rewritten(self):
        entry = {'title': 'A development',
                 'body_markdown': 'What Happened: A factual paragraph. Why It Matters: A consequence.',
                 'sources_text': 'Reuters: https://example.com/report'}
        class Stream:
            def __enter__(self): return self
            def __exit__(self, *args): return None
            def get_final_message(self):
                return type('Message', (), {'content': [type('Block', (), {
                    'type': 'text', 'text': 'A factual paragraph.\n\nA consequence.'})()]})()
        with patch.object(main.client.messages, 'stream', return_value=Stream()):
            draft = main.fit_signal_briefs({'notion_entries': [entry]})
        self.assertEqual(draft['notion_entries'][0]['body_markdown'],
                         'A factual paragraph.\n\nA consequence.')


if __name__ == '__main__':
    unittest.main()
