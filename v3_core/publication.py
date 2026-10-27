"""Pure in-memory publication state model for dry-run and unit testing only."""
from dataclasses import dataclass, field
from hashlib import sha256

@dataclass
class PublicationLedger:
    """No deploys or Notion writes. Production requires persistent atomic storage and locks."""
    published: dict[str, str] = field(default_factory=dict)
    excluded: set[str] = field(default_factory=set)

    def exclude(self, story_id: str) -> None:
        self.excluded.add(story_id)
        self.published.pop(story_id, None)

    def needs_publication(self, story_id: str, content: str, approved: bool) -> bool:
        if story_id in self.excluded or not approved:
            return False
        digest = sha256(content.encode("utf-8")).hexdigest()
        return self.published.get(story_id) != digest

    def record_verified_publication(self, story_id: str, content: str) -> None:
        if story_id in self.excluded:
            raise ValueError("Excluded story cannot publish")
        self.published[story_id] = sha256(content.encode("utf-8")).hexdigest()
