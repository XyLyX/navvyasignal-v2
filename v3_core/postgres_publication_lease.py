"""Server-side PostgreSQL publication lease client. Not enabled in V2.

Only call with a private, dedicated database connection. This module deliberately
has no fallback to Notion or an unlocked build if the database is unavailable.
"""
from dataclasses import dataclass
from uuid import uuid4
from v3_core.atomic_lease import parse_claim, require_claim

class LeaseUnavailable(RuntimeError):
    pass

@dataclass(frozen=True)
class LeaseHandle:
    resource: str
    owner: str
    token: int

class PostgresPublicationLease:
    def __init__(self, connect):
        """connect is an injected callable returning a DB-API context manager."""
        self._connect = connect

    def _one(self, statement, params):
        try:
            with self._connect() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(statement, params)
                    return cursor.fetchone()
        except Exception as exc:
            raise LeaseUnavailable("Publication lease database unavailable; build blocked") from exc

    def claim(self, resource, fingerprint, ttl_seconds=600):
        owner=str(uuid4())
        row=self._one(
            "select acquired, token, phase from publication_private.claim_lease(%s,%s::uuid,%s,%s * interval '1 second')",
            (resource, owner, fingerprint, ttl_seconds),
        )
        if row is None or len(row)!=3:
            raise LeaseUnavailable("Publication lease response invalid; build blocked")
        token=require_claim(parse_claim(dict(zip(("acquired","token","phase"),row))))
        return LeaseHandle(resource,owner,token)

    def transition(self, handle, before, after):
        row=self._one(
            "select publication_private.transition_lease(%s,%s::uuid,%s,%s,%s)",
            (handle.resource,handle.owner,handle.token,before,after),
        )
        if row != (True,):
            raise LeaseUnavailable("Publication lease ownership lost; build blocked")

    def reconcile(self, fingerprint):
        """Read fenced owner after interruption, without claiming or replaying."""
        row=self._one(
            "select owner::text, fencing_token, phase, fingerprint from publication_private.leases where resource=%s",
            ("navvyasignal/v2/production-build",),
        )
        if not row or row[3] != fingerprint or row[2] not in ("build_requested", "ambiguous"):
            raise LeaseUnavailable("No matching outstanding publication lease; manual reconciliation required")
        return LeaseHandle("navvyasignal/v2/production-build",row[0],row[1]),row[2]

    def mark_reconciled(self, handle, phase):
        if phase == "build_requested":
            self.mark_verified(handle)
        elif phase == "ambiguous":
            self.transition(handle,"ambiguous","verified")
        else:
            raise LeaseUnavailable("Invalid reconciliation phase")

    def reserve_build(self, handle):
        """Persist build_requested BEFORE making any external hook request."""
        self.transition(handle,"claimed","build_requested")

    def mark_verified(self, handle):
        self.transition(handle,"build_requested","verified")

    def mark_ambiguous(self, handle):
        self.transition(handle,"build_requested","ambiguous")
