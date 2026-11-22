"""Manual shadow-only review, freeze and parity check for Signal Feed editions."""
import argparse
import datetime as dt
import hashlib
import json
import os
from uuid import UUID

from pipeline.refresh_publication import entry, request

SOURCE = "35b11486-b145-80ac-891f-000bd4c62627"
SITE = "https://navvyasignal.com/publication-state"
FIELDS = (
    "Name", "Signal Brief", "Text 1", "Category", "Content Type",
    "Today's Intelligence", "Homepage Date", "Homepage Priority",
    "Watchlist", "Watch Status", "Next Review", "Coverage Theme",
    "Related Desks", "Long Read", "Watch Trigger",
)


def notion_page(page_id):
    token = os.environ["NOTION_API_KEY"].strip()
    if not token:
        raise ValueError("Notion credentials are missing")
    return request(f"https://api.notion.com/v1/pages/{page_id}", token=token)


def revision(page, page_id, edition):
    if (
        UUID(page["id"]) != page_id
        or page.get("archived") is not False
        or page.get("in_trash", False)
        or UUID(page["parent"]["data_source_id"]) != UUID(SOURCE)
    ):
        raise ValueError("Expected an active Signal Feed page")
    props = page["properties"]
    public = entry(page)
    if not public or (props.get("Content Type", {}).get("select") or {}).get("name") != "Signal":
        raise ValueError("Page is missing the existing Signal publication gate")
    note = "".join(item["plain_text"] for item in props["Internal Note"]["rich_text"])
    marker, separator, record = note.split("\n", 1)[0].partition(":")
    if not separator or marker != "V2_RELEASED" or json.loads(record)["edition"] != edition.isoformat():
        raise ValueError("Page is missing a release marker for the selected edition")
    for name in ("Name", "Signal Brief", "Text 1"):
        prop = props[name]
        if not "".join(item["plain_text"] for item in prop[prop["type"]]).strip():
            raise ValueError(f"Missing required editorial field: {name}")
    payload = {
        "page_id": str(page_id),
        "edition": edition.isoformat(),
        "public_digest": public["digest"],
        "properties": {name: props[name][props[name]["type"]] for name in FIELDS if name in props},
    }
    digest = hashlib.sha256(json.dumps(
        payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode()).hexdigest()
    return payload, digest


def freeze(conn, edition, version, records, actor):
    """Persist a reviewed edition atomically, with exact replay under the same key."""
    from psycopg.types.json import Jsonb

    with conn.transaction(), conn.cursor() as cur:
        cur.execute("""
            insert into publication_shadow.editions(edition_date,version) values (%s,%s)
            on conflict (edition_date,version) do nothing returning id
        """, (edition, version))
        inserted = cur.fetchone()
        if inserted is None:
            cur.execute("""
                select id,status,approved_by from publication_shadow.editions
                where edition_date=%s and version=%s for update
            """, (edition, version))
            edition_id, status, approver = cur.fetchone()
            cur.execute("""
                select payload from publication_shadow.entries where edition_id=%s order by ordinal
            """, (edition_id,))
            if status != "frozen" or approver != actor or [row[0] for row in cur] != records:
                raise ValueError("Edition version already exists with different approval or content")
            return edition_id
        edition_id = inserted[0]
        for ordinal, payload in enumerate(records, 1):
            cur.execute("""
                insert into publication_shadow.entries(edition_id,source_page_id,ordinal,payload,payload_hash)
                select %s,%s,%s,data,encode(sha256(convert_to(data::text,'UTF8')),'hex')
                from (select %s::jsonb as data) as snapshot
            """, (edition_id, payload["page_id"], ordinal, Jsonb(payload)))
        cur.execute("""
            update publication_shadow.editions set status='approved',approved_at=now(),approved_by=%s,
              content_hash=(select encode(sha256(convert_to(
                jsonb_agg(jsonb_build_array(ordinal,source_page_id,payload_hash) order by ordinal)::text,
                'UTF8')), 'hex') from publication_shadow.entries where edition_id=%s)
            where id=%s
        """, (actor, edition_id, edition_id))
        cur.execute("""
            update publication_shadow.editions set status='frozen',frozen_at=now() where id=%s
            returning content_hash
        """, (edition_id,))
        cur.execute("""
            insert into publication_shadow.audit(edition_id,actor,action,new_hash)
            values (%s,%s,'manual_verification_and_approval',%s)
        """, (edition_id, actor, cur.fetchone()[0]))
        return edition_id


def parity(records, live):
    """Compare edition members with the public snapshot, which also contains other editions."""
    if live.get("version") != 1 or not isinstance(live.get("entries"), list):
        raise ValueError("Unexpected production snapshot")
    published = {}
    for item in live["entries"]:
        identifier = str(UUID(item["id"]))
        if identifier in published:
            raise ValueError("Duplicate IDs in production snapshot")
        published[identifier] = item["digest"]
    return [record["page_id"] for record in records
            if published.get(record["page_id"]) != record["public_digest"]]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("edition", type=dt.date.fromisoformat)
    parser.add_argument("pages", nargs="+", help="Page UUIDs, or UUID=reviewed digest when freezing")
    parser.add_argument("--freeze", type=int, metavar="VERSION")
    parser.add_argument("--confirm-verified-and-approved", action="store_true")
    args = parser.parse_args()
    if args.freeze is not None and (
        args.freeze < 1 or not args.confirm_verified_and_approved
        or os.environ.get("GITHUB_ACTIONS") != "true" or not os.environ.get("GITHUB_ACTOR_ID", "").isdigit()
    ):
        parser.error("Freeze needs a positive version and explicit approval by the dispatch actor in GitHub Actions")
    actor = f"github:{os.environ.get('GITHUB_ACTOR_ID')}"
    records, seen = [], set()
    for item in args.pages:
        raw_id, _, reviewed = item.partition("=")
        page_id = UUID(raw_id)
        if page_id in seen:
            parser.error("Duplicate page in edition")
        seen.add(page_id)
        payload, digest = revision(notion_page(page_id), page_id, args.edition)
        if args.freeze is not None and reviewed != digest:
            parser.error(f"Reviewed revision missing or changed for {page_id}")
        if args.freeze is None:
            print(f"{page_id}={digest}")
        else:
            payload["manual_review"] = {"actor": actor, "revision": digest, "verified": True, "approved": True}
        records.append(payload)
    live = request(SITE)
    mismatches = parity(records, live)
    if mismatches:
        raise SystemExit("Production digest missing or different for: " + ", ".join(mismatches))
    if args.freeze is not None:
        import psycopg
        with psycopg.connect(os.environ["SHADOW_PUBLICATION_DATABASE_URL"], connect_timeout=10) as conn:
            print("Frozen shadow edition", freeze(conn, args.edition, args.freeze, records, actor))
    print(f"Production digests match for {len(records)} selected pages")


if __name__ == "__main__":
    main()
