import os, unittest
from unittest.mock import patch
os.environ.setdefault('ANTHROPIC_API_KEY','test-only')
from pipeline import main
class CostGuardTests(unittest.TestCase):
    def test_invalid_brief_never_calls_paid_model(self):
        data={'_no_paid_rewrite':True,'notion_entries':[{'title':'Draft','body_markdown':'x'*1801}]}
        with patch.object(main.client.messages,'stream') as paid:
            with self.assertRaisesRegex(ValueError,'no paid rewrite'):
                main.fit_signal_briefs(data)
            paid.assert_not_called()
    def test_valid_brief_passes_without_paid_model(self):
        data={'_no_paid_rewrite':True,'notion_entries':[{'title':'Draft','body_markdown':'Documented event.\n\nConcrete consequence.'}]}
        with patch.object(main.client.messages,'stream') as paid:
            self.assertEqual(main.fit_signal_briefs(data),data)
            paid.assert_not_called()
