#!/usr/bin/env python3
"""Compare approved public Notion fields with the deployed snapshot. No model calls."""
import hashlib, json, os, re, sys, time, urllib.request

def request(url, payload=None, token=None):
    headers = {"Cache-Control": "no-cache"}
    if token:
        headers.update({"Authorization": "Bearer " + token, "Notion-Version": "2025-09-03",
                        "Content-Type": "application/json"})
    req = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None,
                                 headers=headers)
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)

def entry(page):
    p = page["properties"]
    def text(name):
        prop = p.get(name, {})
        return "".join(t.get("plain_text", "") for t in prop.get("title", prop.get("rich_text", [])))
    def select(name): return (p.get(name, {}).get("select") or {}).get("name", "")
    def date(name): return (p.get(name, {}).get("date") or {}).get("start")
    title = text("Name")
    if not p.get("Ready to Post", {}).get("checkbox") or not title or title.startswith(("[TEST", "[DUPLICATE")):
        return None
    priority = p.get("Homepage Priority", {}).get("number")
    if isinstance(priority, float) and priority.is_integer(): priority = int(priority)
    values = [title, text("Signal Brief"), text("Text 1"), select("Category"), select("Content Type"),
              p.get("Today's Intelligence", {}).get("checkbox") is True,
              date("Homepage Date")[:10] if date("Homepage Date") else None, priority,
              p.get("Watchlist", {}).get("checkbox") is True, select("Watch Status"), date("Next Review"),
              page["created_time"], True,
              [t["name"] for t in p.get("Coverage Theme", {}).get("multi_select", [])]]
    digest = hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    return {"id": page["id"], "digest": digest}

def fetch_entries():
    token = os.environ["NOTION_API_KEY"].strip()
    source = os.environ["NOTION_DATA_SOURCE_ID"].strip()
    if not token or not source: raise ValueError("Notion credentials are missing")
    entries, cursor, seen = {}, None, set()
    for _ in range(500):
        payload = {"page_size": 100, "filter": {"property": "Ready to Post", "checkbox": {"equals": True}}}
        if cursor: payload["start_cursor"] = cursor
        data = request("https://api.notion.com/v1/data_sources/" + source + "/query", payload, token)
        for page in data["results"]:
            value = entry(page)
            if value: entries[value["id"]] = value
        if not data.get("has_more"):
            return sorted(entries.values(), key=lambda e: e["id"])
        cursor = data.get("next_cursor")
        if not cursor or cursor in seen: raise ValueError("Invalid Notion pagination")
        seen.add(cursor)
    raise ValueError("Notion pagination exceeded safety ceiling")

class PublicationTimeout(RuntimeError):
    """A build was accepted, but its public snapshot is still unverified."""

def wait_for_publication(current, timeout_seconds=600, poll_seconds=20):
    deadline = time.monotonic() + timeout_seconds
    last_state = "production snapshot still differs"
    while time.monotonic() < deadline:
        time.sleep(min(poll_seconds, max(0, deadline - time.monotonic())))
        try:
            live = request("https://navvyasignal.com/publication-state")
            if live.get("version") == 1 and live.get("entries") == current:
                print("Production publication verified.", flush=True)
                return
            last_state = "production snapshot still differs"
        except Exception as error:
            # Report the error type only: URLs can contain credentials.
            last_state = "publication-state check failed (" + type(error).__name__ + ")"
        print("Waiting for deployment: " + last_state + ".", flush=True)
    raise PublicationTimeout(
        "Build hook accepted, but publication was not verified within ten minutes; "
        + last_state + ". Notion publication is already complete. "
        "Do not rerun desk research; inspect Netlify deployment status or the next static refresh."
    )

def report_failure(error):
    if isinstance(error, PublicationTimeout):
        message = str(error)
    else:
        # Never print arbitrary exception messages, which may contain secret URLs.
        message = "Refresh failed (" + type(error).__name__ + "); publication is unverified."
    print("Publication refresh failed: " + message, file=sys.stderr)

def publish_approved_snapshot(current):
    # Reuse the durable build receipt, not the editorial release entrypoint:
    # no approval changes, desk prerequisites, ranking, model calls or messages.
    try:
        from pipeline import regional_release as release
    except ImportError:
        import regional_release as release
    key = 'notion-refresh-v1/' + hashlib.sha256(json.dumps(current, sort_keys=True).encode()).hexdigest()
    api = release.Notion()
    ledger, state = api.ledger(key)
    if state.get('phase') == 'verified':
        # A previously published snapshot may legitimately be restored later.
        # In-flight/ambiguous requests are deliberately never reset here.
        state['phase'] = 'staging'
        api.save_ledger(ledger, state)
    release.publish_once(api, ledger, state)

def main(approved_refresh=False):
    current = fetch_entries()
    deployed = request("https://navvyasignal.com/publication-state")
    if deployed.get("version") != 1 or not isinstance(deployed.get("entries"), list):
        raise ValueError("Deployed publication state is unavailable; no blind build triggered")
    if current == deployed["entries"]:
        print("Approved public content matches production; no build needed.")
        return
    print("Approved public content differs from production.")
    if os.environ.get("DRY_RUN", "false").lower() == "true":
        print("Dry run: no build triggered.")
        return
    if not approved_refresh:
        raise RuntimeError("Direct refresh builds are retired without --approved-refresh. Use the dedicated approved-content refresh workflow")
    publish_approved_snapshot(current)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--approved-refresh', action='store_true')
    args = parser.parse_args()
    try: main(approved_refresh=args.approved_refresh)
    except Exception as error:
        report_failure(error)
        sys.exit(1)
