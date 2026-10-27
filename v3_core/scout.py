"""Deterministic source ingestion: caller supplies bytes; no network or side effects."""
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from .policy import canonical_url

MAX_FEED_BYTES = 2_000_000
MAX_ITEMS = 200

@dataclass(frozen=True)
class SourceItem:
    source_id: str
    publisher: str
    title: str
    url: str
    discovered_at: str
    published_at: str | None = None

def ingest_rss(xml_bytes: bytes, publisher: str, allowed_hosts: frozenset[str],
               discovered_at: str | None = None) -> list[SourceItem]:
    """Parse RSS/Atom safely; hosts must be explicitly allowlisted by configuration."""
    if len(xml_bytes) > MAX_FEED_BYTES:
        raise ValueError("Feed exceeds size limit")
    if b"<!DOCTYPE" in xml_bytes.upper() or b"<!ENTITY" in xml_bytes.upper():
        raise ValueError("DTD/entities not permitted")
    root = ET.fromstring(xml_bytes)
    at = discovered_at or datetime.now(timezone.utc).isoformat()
    output = []
    seen = set()
    for node in root.iter():
        if node.tag.rsplit("}", 1)[-1] not in {"item", "entry"}:
            continue
        title = ""
        url = ""
        pubdate = None
        for child in node:
            name = child.tag.rsplit("}", 1)[-1]
            if name == "title":
                title = (child.text or "").strip()
            elif name == "link":
                url = (child.attrib.get("href") or child.text or "").strip()
            elif name in {"pubDate", "published", "updated"}:
                pubdate = (child.text or "").strip()
        if not title or not url:
            continue
        try:
            url = canonical_url(url)
        except ValueError:
            continue
        host = (urlsplit(url).hostname or "").lower()
        if host not in allowed_hosts:
            continue
        if url in seen:
            continue
        seen.add(url)
        output.append(SourceItem(sha256(url.encode()).hexdigest(), publisher, title[:500], url, at, pubdate))
        if len(output) >= MAX_ITEMS:
            break
    return output
