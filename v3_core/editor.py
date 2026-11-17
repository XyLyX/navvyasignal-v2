"""Editorial handoff contract; no Claude call or Notion writes in shadow mode."""
from dataclasses import dataclass
from .analyst import EvidenceBundle
from .policy import Story, Assessment, evaluate

@dataclass(frozen=True)
class DraftCandidate:
    headline: str
    region: str
    themes: tuple[str, ...]
    sources: tuple[str, ...]
    status: str
    reasons: tuple[str, ...]
    # Editor must independently map each factual claim to source evidence before setting verified_claims.

def prepare_candidate(bundle: EvidenceBundle, *, official_primary: bool = False,
                      verified_claims: bool = False, sensitive_categories: frozenset[str] = frozenset(),
                      exclusion_fingerprints: frozenset[str] = frozenset()) -> DraftCandidate:
    record = Story(headline=bundle.headline, source_urls=bundle.source_urls,
                   independent_source_groups=bundle.source_groups,
                   primary_official_source=official_primary,
                   categories=sensitive_categories, verified_claims=verified_claims)
    decision: Assessment = evaluate(record, exclusion_fingerprints)
    return DraftCandidate(bundle.headline, bundle.region, tuple(sorted(bundle.themes)),
                          bundle.source_urls, decision.decision.value, decision.reasons)
