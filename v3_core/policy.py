"""Pure editorial eligibility checks. AI confidence never bypasses mandatory evidence."""
from dataclasses import dataclass
from enum import Enum
from hashlib import sha256
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
import re

SENSITIVE = frozenset({"conflict", "casualties", "criminal_allegation", "political_dispute",
                       "leak", "security", "unverified_claim", "legal_allegation"})
TRACKING = frozenset({"fbclid", "gclid", "mc_cid", "mc_eid"})

class Decision(str, Enum):
    AUTO_ELIGIBLE = "auto_eligible"
    MANUAL_REVIEW = "manual_review"
    REJECTED = "rejected"

@dataclass(frozen=True)
class Story:
    headline: str
    source_urls: tuple[str, ...]
    independent_source_groups: tuple[str, ...]
    primary_official_source: bool
    categories: frozenset[str]
    disputed: bool = False
    conflicting_reports: bool = False
    verified_claims: bool = False
    previously_excluded: bool = False
    ai_confidence: float = 0.0

@dataclass(frozen=True)
class Assessment:
    decision: Decision
    reasons: tuple[str, ...]

def canonical_url(url: str) -> str:
    p = urlsplit(url.strip())
    if p.scheme.lower() not in {"https", "http"} or not p.hostname:
        raise ValueError("Source must be an absolute HTTP(S) URL")
    if p.username or p.password:
        raise ValueError("Credential-bearing URLs are not permitted")
    query = urlencode(sorted((k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
                             if k.lower() not in TRACKING and not k.lower().startswith("utm_")))
    path = re.sub(r"/+", "/", p.path or "/")
    return urlunsplit((p.scheme.lower(), p.netloc.lower(), path.rstrip("/") or "/", query, ""))

def fingerprint(headline: str, source_urls: tuple[str, ...]) -> str:
    urls = sorted({canonical_url(u) for u in source_urls})
    return sha256((re.sub(r"\s+", " ", headline.strip().casefold()) + "\n" + "\n".join(urls)).encode()).hexdigest()

def evaluate(story: Story, exclusion_fingerprints: frozenset[str] = frozenset()) -> Assessment:
    reasons = []
    if story.previously_excluded:
        return Assessment(Decision.REJECTED, ("previously_excluded",))
    try:
        key = fingerprint(story.headline, story.source_urls)
        if key in exclusion_fingerprints:
            return Assessment(Decision.REJECTED, ("excluded_fingerprint",))
        urls = {canonical_url(u) for u in story.source_urls}
    except ValueError:
        reasons.append("invalid_source_url")
        urls = set()
    if not story.headline.strip():
        reasons.append("missing_headline")
    if not urls:
        reasons.append("missing_sources")
    if not story.verified_claims:
        reasons.append("claims_not_verified")
    if not story.primary_official_source and len(set(story.independent_source_groups)) < 2:
        reasons.append("insufficient_independent_corroboration")
    if story.categories & SENSITIVE:
        reasons.append("sensitive_topic")
    if story.disputed or story.conflicting_reports:
        reasons.append("disputed_or_conflicting")
    return Assessment(Decision.MANUAL_REVIEW if reasons else Decision.AUTO_ELIGIBLE, tuple(reasons))
