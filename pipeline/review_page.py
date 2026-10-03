#!/usr/bin/env python3
"""
Read-only Gemini review of ONE Notion Signal Feed entry.

Reads the entry's title, Signal Brief, public sources (Text 1) and complete top-level
article body from Notion with GET requests only, then asks the existing V2 Gemini
fact-check (pipeline/main.py: gemini_review) to review that content.

Deliberately NOT done here: Notion writes, content regeneration, publication, homepage
changes, deployments, Netlify builds, email, WhatsApp. Private fields (Internal Note and
everything else) are never read into the review payload.

Exit codes:
  0  review completed and Gemini reported FLAGS: 0 (PASSED)
  1  review could not be completed (retrieval, Gemini call or response parsing failed)
  3  review completed and Gemini raised concerns (NOT passed)
"""

import datetime
import hashlib
import inspect
import json
import os
import re
import sys

import requests

# main.py builds an Anthropic client at import time. This script never calls Anthropic, so a
# placeholder keeps the import side-effect free without needing that secret.
os.environ.setdefault("ANTHROPIC_API_KEY", "review-only-not-used")

try:
    from pipeline import main as pipeline_main
except ImportError:  # run as `python review_page.py` from inside pipeline/
    import main as pipeline_main

NOTION_VERSION = "2022-06-28"
NOTION_API = "https://api.notion.com/v1"

TEXT_BLOCK_TYPES = {
    "paragraph", "heading_1", "heading_2", "heading_3",
    "bulleted_list_item", "numbered_list_item", "quote", "callout",
}
SKIPPED_BLOCK_TYPES = {"divider"}

EXIT_PASSED = 0
EXIT_FAILED = 1
EXIT_CONCERNS = 3


class ReviewError(Exception):
    """The review could not be completed. Never reported as a pass."""


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_page_id(raw):
    value = (raw or "").strip().replace("-", "")
    if not re.fullmatch(r"[0-9a-fA-F]{32}", value):
        raise ReviewError("PAGE_ID must be a 32-character Notion page ID (dashes optional).")
    return value.lower()


def rich_text_plain(items):
    return "".join(part.get("plain_text", "") for part in (items or []))


def _get(path, headers, params=None):
    try:
        resp = requests.get(f"{NOTION_API}{path}", headers=headers, params=params, timeout=30)
    except requests.RequestException as exc:
        raise ReviewError(f"Notion request failed ({path}): {exc.__class__.__name__}") from exc
    if resp.status_code != 200:
        raise ReviewError(f"Notion returned HTTP {resp.status_code} for {path}.")
    try:
        return resp.json()
    except ValueError as exc:
        raise ReviewError(f"Notion returned non-JSON for {path}.") from exc


def fetch_page(page_id, headers):
    return _get(f"/pages/{page_id}", headers)


def fetch_blocks(page_id, headers):
    blocks, cursor = [], None
    while True:
        params = {"page_size": 100}
        if cursor:
            params["start_cursor"] = cursor
        data = _get(f"/blocks/{page_id}/children", headers, params)
        blocks.extend(data.get("results", []))
        if not data.get("has_more"):
            return blocks
        cursor = data.get("next_cursor")
        if not cursor:
            raise ReviewError("Notion reported more blocks but gave no cursor; body incomplete.")


def article_body_text(blocks):
    """Complete top-level article text, or ReviewError if any content cannot be read."""
    lines, unsupported = [], []
    for block in blocks:
        kind = block.get("type")
        if kind in SKIPPED_BLOCK_TYPES:
            continue
        if kind not in TEXT_BLOCK_TYPES:
            unsupported.append(str(kind))
            continue
        if block.get("has_children"):
            unsupported.append(f"{kind} with nested children")
            continue
        text = rich_text_plain(block.get(kind, {}).get("rich_text"))
        if not text.strip():
            continue
        if kind.startswith("heading_"):
            text = "## " + text
        lines.append(text)
    if unsupported:
        raise ReviewError(
            "Article body contains content this review cannot read completely: "
            + ", ".join(sorted(set(unsupported))) + ". Review not completed.")
    if not lines:
        raise ReviewError("Article body is empty; nothing to review.")
    return "\n\n".join(lines)


def build_review_payload(page, blocks):
    """The ONLY content sent to Gemini. Internal Note and all other fields are excluded."""
    props = page.get("properties", {})
    title = rich_text_plain(props.get("Name", {}).get("title"))
    signal_brief = rich_text_plain(props.get("Signal Brief", {}).get("rich_text"))
    public_sources = rich_text_plain(props.get("Text 1", {}).get("rich_text"))
    if not title.strip():
        raise ReviewError("Entry has no title.")
    if not signal_brief.strip():
        raise ReviewError("Entry has no Signal Brief.")
    if not public_sources.strip():
        raise ReviewError("Entry has no public sources (Text 1).")
    return {
        "title": title,
        "signal_brief": signal_brief,
        "public_sources": public_sources,
        "article_body": article_body_text(blocks),
    }


def gemini_model_name():
    """The model the existing integration actually calls, read from its own source."""
    match = re.search(r"/models/([^:/\"']+):generateContent", inspect.getsource(pipeline_main.call_gemini))
    if not match:
        raise ReviewError("Could not determine the Gemini model from the existing integration.")
    return match.group(1)


def parse_review(text):
    """Return (flag_count, findings). Anything not in the agreed format is a failure."""
    if not text or not text.strip():
        raise ReviewError("Gemini returned no review text.")
    match = re.search(r"^\s*FLAGS:\s*(\d+)\s*$", text, re.MULTILINE)
    if not match:
        raise ReviewError("Gemini response did not follow the FLAGS format; review not completed.")
    count = int(match.group(1))
    findings = [ln.strip()[2:].strip() for ln in text.splitlines() if ln.strip().startswith("- ")]
    if count > 0 and not findings:
        raise ReviewError("Gemini reported concerns but listed none; review not completed.")
    if count == 0 and findings:
        raise ReviewError("Gemini reported FLAGS: 0 but also listed concerns; review not completed.")
    return count, findings


def summary_markdown(result):
    lines = ["## V2 Gemini draft review (read-only)", ""]
    for label, key in (("Result", "status"), ("Entry", "title"), ("Page ID", "page_id"),
                       ("Page last edited (Notion)", "page_last_edited"),
                       ("Newest article block edit", "newest_block_edit"),
                       ("Content fetched at", "fetched_at"),
                       ("Gemini model", "model"), ("Content SHA-256", "content_sha256"),
                       ("Ready to Post at fetch time", "ready_to_post")):
        if result.get(key) is not None:
            lines.append(f"- **{label}:** {result[key]}")
    if result.get("reviewed"):
        lines.append(f"- **Reviewed:** {result['reviewed']}")
    lines.append("- **Notion writes / publication / sends:** none")
    lines.append("")
    if result.get("error"):
        lines += ["### Review not completed", "", result["error"], ""]
    elif result.get("findings"):
        lines += [f"### Gemini raised {len(result['findings'])} concern(s)", ""]
        lines += [f"- {item}" for item in result["findings"]] + [""]
    elif result.get("status") == "PASSED":
        lines += ["### Gemini raised no concerns (FLAGS: 0)", ""]
    return "\n".join(lines)


def run(environ=None):
    """Execute the review. Returns (exit_code, result_dict). Never raises ReviewError."""
    env = environ if environ is not None else os.environ
    result = {"status": "FAILED", "fetched_at": utc_now()}
    try:
        for name in ("NOTION_API_KEY", "NOTION_DATABASE_ID", "GEMINI_API_KEY", "PAGE_ID"):
            if not env.get(name):
                raise ReviewError(f"Missing required setting: {name}.")
        page_id = normalize_page_id(env["PAGE_ID"])
        result["page_id"] = page_id
        headers = {"Authorization": f"Bearer {env['NOTION_API_KEY']}",
                   "Notion-Version": NOTION_VERSION}

        page = fetch_page(page_id, headers)
        parent = page.get("parent", {})
        expected = env["NOTION_DATABASE_ID"].replace("-", "").lower()
        if parent.get("type") != "database_id" or \
                str(parent.get("database_id", "")).replace("-", "").lower() != expected:
            raise ReviewError("Page is not an entry of the Signal Feed database; refusing to review.")
        if page.get("archived") or page.get("in_trash"):
            raise ReviewError("Page is archived or in trash; refusing to review.")

        blocks = fetch_blocks(page_id, headers)
        payload = build_review_payload(page, blocks)

        edits = [b.get("last_edited_time") for b in blocks if b.get("last_edited_time")]
        result.update({
            "title": payload["title"],
            "page_last_edited": page.get("last_edited_time"),
            "newest_block_edit": max(edits) if edits else None,
            "ready_to_post": "checked" if page.get("properties", {}).get(
                "Ready to Post", {}).get("checkbox") else "unchecked",
            "reviewed": (f"title, Signal Brief ({len(payload['signal_brief'])} chars), public sources "
                         f"({len(payload['public_sources'])} chars), article body "
                         f"({len(payload['article_body'])} chars, {len(blocks)} top-level blocks)"),
            "content_sha256": hashlib.sha256(
                json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest(),
        })
        result["model"] = gemini_model_name()

        pipeline_main.GEMINI_API_KEY = env["GEMINI_API_KEY"]
        review = pipeline_main.gemini_review(json.dumps(payload))
        if review is None:
            raise ReviewError("Gemini call failed (no usable response); review not completed.")
        count, findings = parse_review(review)
        result["findings"] = findings
        if count == 0:
            result["status"] = "PASSED"
            return EXIT_PASSED, result
        result["status"] = "CONCERNS RAISED (not passed)"
        return EXIT_CONCERNS, result
    except ReviewError as exc:
        result["status"] = "FAILED (review not completed)"
        result["error"] = str(exc)
        return EXIT_FAILED, result


def main():
    code, result = run()
    markdown = summary_markdown(result)
    print(markdown)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as handle:
            handle.write(markdown + "\n")
    print(f"REVIEW RESULT: {result['status']}")
    sys.exit(code)


if __name__ == "__main__":
    main()
