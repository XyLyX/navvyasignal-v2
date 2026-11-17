"""Evidence grouping and regional routing, without editorial claims of verification."""
from dataclasses import dataclass
from urllib.parse import urlsplit
from .scout import SourceItem

REGIONS = ("north_america", "europe", "india_subcontinent", "uae_middle_east")
THEMES = frozenset({"technology_ai", "markets_capital", "maritime_energy", "politics",
                    "business", "security", "infrastructure", "society"})

@dataclass(frozen=True)
class EvidenceBundle:
    headline: str
    source_urls: tuple[str, ...]
    source_groups: tuple[str, ...]
    region: str
    themes: frozenset[str]
    verified_claims: bool = False

def source_group(url: str) -> str:
    """Host-level conservative grouping; shared ownership requires further registry."""
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host

def assemble(items: list[SourceItem], region: str, themes: frozenset[str]) -> EvidenceBundle:
    if region not in REGIONS:
        raise ValueError("Unknown region")
    if not themes <= THEMES:
        raise ValueError("Unknown theme")
    if not items:
        raise ValueError("No evidence items")
    # Never equate multiple links with independent corroboration or verified claims.
    return EvidenceBundle(items[0].title, tuple(x.url for x in items),
                          tuple(source_group(x.url) for x in items), region, themes)
