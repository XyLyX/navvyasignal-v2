"""Offline editorial selection contract tests; no provider calls or credentials."""
import unittest
from pipeline.editorial_selection import validate_assessments


def assessment(identifier):
    return {'id': identifier, 'urgency': 3, 'consequence': 4,
            'reach': 2, 'rationale': 'Verified consequence of the approved report'}


class RankingContractTests(unittest.TestCase):
    def test_exact_complete_set(self):
        self.assertEqual(len(validate_assessments([assessment('a'), assessment('b')], {'a', 'b'})), 2)

    def test_missing(self):
        with self.assertRaises(ValueError):
            validate_assessments([assessment('a')], {'a', 'b'})

    def test_duplicate(self):
        with self.assertRaises(ValueError):
            validate_assessments([assessment('a'), assessment('a')], {'a', 'b'})

    def test_unknown(self):
        with self.assertRaises(ValueError):
            validate_assessments([assessment('a'), assessment('x')], {'a', 'b'})

    def test_malformed(self):
        with self.assertRaises(ValueError):
            validate_assessments([None], {'a'})

    def test_invalid_scores(self):
        bad = assessment('a')
        bad['urgency'] = True
        with self.assertRaises(ValueError):
            validate_assessments([bad], {'a'})

    def test_empty_rationale(self):
        bad = assessment('a')
        bad['rationale'] = ' '
        with self.assertRaises(ValueError):
            validate_assessments([bad], {'a'})


if __name__ == '__main__':
    unittest.main()
