import unittest
from v3_core.scout import ingest_rss
from v3_core.analyst import assemble
from v3_core.editor import prepare_candidate

RSS=b'<rss><channel><item><title>Official update</title><link>https://official.example/news?utm_source=x</link><pubDate>Tue</pubDate></item><item><title>Ignored</title><link>https://other.example/news</link></item></channel></rss>'

class PipelineTests(unittest.TestCase):
    def test_allowlisted_rss(self):
        items=ingest_rss(RSS,"Official",frozenset({"official.example"}), "2026-10-27T00:00:00Z")
        self.assertEqual(len(items),1)
        self.assertEqual(items[0].url,"https://official.example/news")
    def test_disallowed_dtd(self):
        with self.assertRaises(ValueError):
            ingest_rss(b'<!DOCTYPE x><rss/>',"x",frozenset({"x"}))
    def test_large_feed(self):
        with self.assertRaises(ValueError):
            ingest_rss(b'x'*2000001,"x",frozenset({"x"}))
    def test_unverified_by_default(self):
        bundle=assemble(ingest_rss(RSS,"Official",frozenset({"official.example"})),
                        "uae_middle_east",frozenset({"business"}))
        candidate=prepare_candidate(bundle,official_primary=True)
        self.assertEqual(candidate.status,"manual_review")
        self.assertIn("claims_not_verified",candidate.reasons)
    def test_eligible_only_after_explicit_evidence(self):
        bundle=assemble(ingest_rss(RSS,"Official",frozenset({"official.example"})),
                        "uae_middle_east",frozenset({"business"}))
        self.assertEqual(prepare_candidate(bundle,official_primary=True,verified_claims=True).status,"auto_eligible")
    def test_invalid_region(self):
        with self.assertRaises(ValueError):
            assemble(ingest_rss(RSS,"Official",frozenset({"official.example"})),
                     "wrong_region",frozenset({"business"}))
if __name__=="__main__":
    unittest.main()
