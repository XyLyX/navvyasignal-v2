"""Fail-closed adapter contract for a future dedicated publication lease service.

Not wired into V2: no database or credentials have been provisioned.
Never interpret an unknown claim result as permission to trigger a build.
"""
from dataclasses import dataclass
from enum import Enum

class LeaseDecision(str, Enum):
    ACQUIRED = "acquired"
    BUSY = "busy"

@dataclass(frozen=True)
class LeaseClaim:
    decision: LeaseDecision
    fencing_token: int | None = None

def parse_claim(row: dict | None) -> LeaseClaim:
    if not isinstance(row, dict) or type(row.get("acquired")) is not bool:
        raise RuntimeError("Unknown atomic lease response: publication blocked")
    if not row["acquired"]:
        return LeaseClaim(LeaseDecision.BUSY)
    token = row.get("token")
    if type(token) is not int or token < 1 or row.get("phase") != "claimed":
        raise RuntimeError("Invalid lease fencing token: publication blocked")
    return LeaseClaim(LeaseDecision.ACQUIRED, token)

def require_claim(claim: LeaseClaim) -> int:
    if claim.decision != LeaseDecision.ACQUIRED or not claim.fencing_token:
        raise RuntimeError("Atomic publication lease not held")
    return claim.fencing_token
