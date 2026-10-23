# Desk failure corrections — 23 October 2026

Failures observed in the actual dispatched runs:

- North America: unknown update target aborted the whole approved batch.
- Europe: one pass omitted its targeted source search and aborted discovery.
- India: all candidates failed freshness/source validation, aborting the desk.
- Release and delivery then correctly refused missing completion receipts.
- Later scheduled fallback jobs were green because they delegated to Netlify,
  not because they published or delivered the edition.

Corrections:

- Normalize UUID formatting only when it matches an actual fetched target. Hold
  unknown updates privately, preserving their target and draft, before spending
  verification calls. Never guess the target or turn the update into a new post.
- Give an incomplete discovery pass one bounded recovery, preserving other passes.
  Preserve actual search evidence and recovery reasons. Use a local news source
  for the society/technology pass instead of requiring a financial regulator.
- Incomplete evidence yields no candidates from that pass. Source and date checks
  remain mandatory; no fabricated dates or approvals. A stale-only result stays
  excluded. Empty/incomplete coverage is retained as a private operational review
  record, never published as news. Qualified candidates from other passes continue.
- A processed desk receipt records saved/held counts, coverage status and review
  need. Zero approved stories is a processed outcome, as it already is when all
  story verifications are held. A provider outage or failed Notion save remains a
  technical failure and cannot fabricate a completed receipt.
- Delegated fallback runs now explicitly report that no editorial work occurred.

No desk times, approval standards, daily release, send gates, or independent
half-hour Notion refresh schedules were changed. This code repair does not itself
re-run today's paid research or resend email/WhatsApp. The historical failed runs
remain failed. End-to-end recovery requires an actual new live edition run.
