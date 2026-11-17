"""Fail-closed Netlify deploy receipt for code-only publication.

A build-hook HTTP success is not proof of a published deploy. Require a fresh
production deploy for the exact expected Git commit before releasing the lease.
"""
import datetime as dt
import json
import os
import time
import urllib.request

SITE_ID = "9715c02b-ace7-419f-a418-a2930a311b4e"
API = "https://api.netlify.com/api/v1/sites/" + SITE_ID + "/deploys?per_page=30"

def deployments():
    token = os.environ.get("NETLIFY_AUTH_TOKEN", "").strip()
    if not token:
        raise RuntimeError("NETLIFY_AUTH_TOKEN missing; code publication blocked")
    req = urllib.request.Request(API, headers={"Authorization": "Bearer " + token,
                                                "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=25) as response:
        value = json.load(response)
    if not isinstance(value, list):
        raise RuntimeError("Invalid Netlify deployment response")
    return value

def baseline():
    return {d["id"] for d in deployments() if d.get("id")}

def verify(expected_commit, before, started_at, timeout=600, interval=15):
    """Require a *new*, published production deploy with the exact commit.

    Never treat a queued/building/ready preview or an older deploy as success.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for d in deployments():
            if d.get("id") in before or d.get("context") != "production":
                continue
            if d.get("commit_ref") != expected_commit:
                continue
            if d.get("state") != "ready" or not d.get("published_at"):
                continue
            try:
                published = dt.datetime.fromisoformat(d["published_at"].replace("Z", "+00:00"))
            except (TypeError, ValueError):
                continue
            if published >= started_at:
                return d["id"]
        time.sleep(min(interval, max(0, deadline - time.monotonic())))
    raise RuntimeError("Code deploy not verified; inspect Netlify and reconcile lease manually")
