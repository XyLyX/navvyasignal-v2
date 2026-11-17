"""Optional server-only gate for every V2 build-hook entry point.

Activation requires PUBLICATION_LEASE_REQUIRED=true and a private DATABASE_URL.
The shared resource serializes Notion refresh, daily release and code-only builds.
Never fall back to an unlocked build when explicitly enabled.
"""
import hashlib
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v3_core.postgres_publication_lease import PostgresPublicationLease

RESOURCE = "navvyasignal/v2/production-build"

def required():
    return os.environ.get("PUBLICATION_LEASE_REQUIRED", "").lower() == "true"

def connect():
    import psycopg
    url=os.environ.get("PUBLICATION_DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("Private publication database URL missing; build blocked")
    return psycopg.connect(url, connect_timeout=10)

def claim(fingerprint):
    if not required():
        return None, None
    if len(fingerprint)!=64:
        raise ValueError("Invalid build fingerprint")
    client=PostgresPublicationLease(connect)
    handle=client.claim(RESOURCE,fingerprint,ttl_seconds=600)
    return client,handle

def reserve(client,handle):
    if client is not None:
        client.reserve_build(handle)

def verified(client,handle):
    if client is not None:
        client.mark_verified(handle)

def ambiguous(client,handle):
    if client is not None:
        client.mark_ambiguous(handle)

def code_fingerprint(commit, request_time):
    return hashlib.sha256(("site-code/"+commit+"/"+request_time).encode()).hexdigest()
