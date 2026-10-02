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

def main():
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
    hook = os.environ["V2_NETLIFY_BUILD_HOOK"].strip()
    if not re.fullmatch(r"https://api\.netlify\.com/build_hooks/[A-Za-z0-9]+", hook):
        raise ValueError("Invalid build hook")
    req = urllib.request.Request(hook, data=b"", method="POST")
    with urllib.request.urlopen(req, timeout=30) as response:
        if response.status not in (200, 201, 202): raise ValueError("Build hook rejected")
    print("V2 refresh requested; waiting for deployed public content.", flush=True)
    for attempt in range(12):
        time.sleep(20)
        try:
            live = request("https://navvyasignal.com/publication-state")
            if live.get("version") == 1 and live.get("entries") == current:
                print("Production publication verified.", flush=True)
                return
        except Exception:
            pass
    raise RuntimeError("Build request succeeded, but production content was not published within four minutes")

if __name__ == "__main__":
    try: main()
    except Exception as error:
        print("Publication refresh failed:", type(error).__name__, file=sys.stderr)
        sys.exit(1)
