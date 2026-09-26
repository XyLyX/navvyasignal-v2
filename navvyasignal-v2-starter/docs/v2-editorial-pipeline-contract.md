# NavvyaSignal V2 editorial pipeline contract

Source of truth for the legacy automation: user-supplied `main.py` (reviewed September 26, 2026). This document records its actual behaviour and the V2 migration boundary; it does not assert that the legacy script is installed in the V2 repository.

## Voice and coverage

NavvyaSignal is a restrained, analytical intelligence publication, distinct from Being Navvyn and Navyaa. Seven exact primary desks: West Asia Desk; India Desk; UAE Desk; Global Politics Desk; Markets & Capital Desk; Technology & AI Desk; Maritime Energy & Supply Chains Desk. UAE-specific stories belong to UAE Desk first. Assign one primary desk, optionally 0–3 Coverage Theme tags and Related Desks. Each desk runs independently and must perform both broad daily-roundup and breaking-incident searches. Do not confuse cross-cutting themes with desks.

## Reporting and verification

Each new signal must report a verifiable development within the last 24–48 hours. Earlier facts may appear only as brief context. Research with live web search; do not fabricate quotes, figures or sources. Match the same underlying subject within 48 hours as an update rather than creating duplicates. The generated `body_markdown` is actually plain text: developed prose covering what happened and why it matters, without markdown headings or emphasis, up to 1,800 characters in the generation schema. Source names and supporting references are separate `sources_text` (up to 1,800 characters in the generation schema). Flag genuine ambiguity in `notes` / Internal Note. Gemini cross-checks each desk's draft; Claude may re-search, correct or hedge/strip unresolved claims. IMPORTANT: the legacy code proceeds without cross-verification when Gemini is unavailable and does not programmatically recheck final disputed claims; V2 must not describe this as guaranteed verification.

## Exact Notion property mapping (verified from main.py)

- `Name`: headline.
- `Category`: primary desk.
- `Signal Brief`: **the full editorial signal prose** (`body_markdown` cleaned of markdown; at most 2,000 characters stored). This is not a separate short teaser.
- `Text 1`: **sources_text**, at most 2,000 characters stored. Never render as the article body.
- `Internal Note`: private notes/ambiguities; do not publish as article or social copy.
- `Long Read`: false for routine signals, Cross-Desk and Briefing entries. Long Read body may be in Notion page blocks for selected older records.
- `Ready to Post`: true on each successful legacy write; V2 read adapter still gates publication on this checkbox.
- `Synced to Framer`: false on every legacy write, including updates. This is V1-only state; V2 must never depend on or reset it.
- `Content Type`: Signal, Cross-Desk or Briefing as applicable.
- `Today's Intelligence`: selected at compile time, up to seven, without desk quotas. V2 additionally requires a valid `Homepage Date` to appear on its date-scoped homepage; the legacy main.py does **not** populate that date or `Homepage Priority`.
- Watchlist: only specific unresolved questions, with Watch Trigger and Next Review; resolution requires direct evidence.

## Compilation and distribution

Seven desk jobs research and write Notion, without sending. The later `compile_send` run collects the recent Notion entries (15-hour window), assembles Kit email and Whapi WhatsApp messages **without adding new factual claims**, selects Today's Intelligence, optionally creates a genuinely new Cross-Desk synthesis, and conservatively resolves Watchlist items. The current script sends Kit then Whapi automatically; no manual approval stage. Proper-case email subjects. WhatsApp copy is concise and closes with navvyasignal.com. Friday weekly synthesis uses the previous week's existing entries, with no new research; the uploaded file does not demonstrate that a deployed Friday automation is operating. No ASCII diagrams/tables for site or social content. Social posts are manual, not automated by main.py.

## V2 migration boundary and unresolved differences

V2 is a read-only Notion consumer, currently statically built on Netlify. It must display `Signal Brief` as report prose and `Text 1` as sources. The public site cannot infer actual publication time from Notion `created_time`; use an explicit publication date when available. The V2 date-specific homepage requires `Homepage Date`, which the uploaded legacy script does not write. Implement a deliberate date/priority mapping before claiming automatic daily homepage refresh. Preserve V1 Framer and existing Kit/Whapi automations during V2 launch; do not duplicate sends or silently switch subscribers to a new sender. The public WhatsApp Channel invitation URL is separate from the Whapi channel ID used for automated sends. Do not promise automatic social posting or live Notion updates without implementing them.

## Legacy implementation risks to address separately

The legacy code comments sometimes conflict with behaviour: its main prompt asks for What Happened / Why It Matters but its JSON schema explicitly forbids visible section labels; its Gemini loop may continue if Gemini is unavailable; `fetch_todays_entries_for_compile` filters by last edit, not a dedicated publication timestamp, and retrieves one page of 100 records. The current V2 code has a frozen launch allowlist that should eventually be retired after homepage-date and editorial selection are operational. Do not change these behaviours implicitly as part of the launch deploy.
