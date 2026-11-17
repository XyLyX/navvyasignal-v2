import unittest
from v3_core.policy import Story, Decision, evaluate, fingerprint, canonical_url
from v3_core.publication import PublicationLedger

def story(**changes):
    args = dict(headline="Official company announcement", source_urls=("https://example.org/news?utm_source=x",),
                independent_source_groups=("example.org",), primary_official_source=True,
                categories=frozenset({"business"}), verified_claims=True)
    args.update(changes)
    return Story(**args)

class EditorialPolicyTests(unittest.TestCase):
    def test_official_low_risk(self):
        self.assertEqual(evaluate(story()).decision, Decision.AUTO_ELIGIBLE)
    def test_conflict_manual(self):
        self.assertEqual(evaluate(story(categories=frozenset({"conflict"}))).decision, Decision.MANUAL_REVIEW)
    def test_no_evidence_manual_even_high_ai_confidence(self):
        self.assertEqual(evaluate(story(verified_claims=False, ai_confidence=1.0)).decision, Decision.MANUAL_REVIEW)
    def test_two_independent_sources(self):
        s=story(primary_official_source=False, source_urls=("https://a.org/a", "https://b.org/b"),
                independent_source_groups=("a.org", "b.org"))
        self.assertEqual(evaluate(s).decision, Decision.AUTO_ELIGIBLE)
    def test_same_source_group_not_independent(self):
        s=story(primary_official_source=False, independent_source_groups=("a.org", "a.org"))
        self.assertEqual(evaluate(s).decision, Decision.MANUAL_REVIEW)
    def test_exclusion(self):
        s=story()
        self.assertEqual(evaluate(s, frozenset({fingerprint(s.headline,s.source_urls)})).decision, Decision.REJECTED)
    def test_url_canonicalization(self):
        self.assertEqual(canonical_url("https://EXAMPLE.org/news/?utm_source=x&b=2"),"https://example.org/news?b=2")
    def test_bad_source(self):
        self.assertEqual(evaluate(story(source_urls=("file:///secret",))).decision, Decision.MANUAL_REVIEW)
    def test_no_change_no_build(self):
        l=PublicationLedger()
        self.assertTrue(l.needs_publication("a","content",True))
        l.record_verified_publication("a","content")
        self.assertFalse(l.needs_publication("a","content",True))
        self.assertTrue(l.needs_publication("a","changed",True))
        self.assertFalse(l.needs_publication("a","changed",False))
    def test_excluded_never_republishes(self):
        l=PublicationLedger()
        l.exclude("a")
        self.assertFalse(l.needs_publication("a","new",True))
        with self.assertRaises(ValueError): l.record_verified_publication("a","new")

if __name__=="__main__":
    unittest.main()
