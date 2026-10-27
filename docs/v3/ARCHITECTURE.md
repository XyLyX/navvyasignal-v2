# NavvyaSignal 3.0 — Hybrid Editorial Architecture
Status: design only; not connected to production. Baseline: release/v2-english. Date: 2026-10-27.

## Scope
One shared research pipeline; four regional publication desks (North America, Europe, India & Subcontinent, UAE & Middle East); cross-cutting coverage themes. Preserve historical published articles, URLs, Notion editorial records, and existing website until verified cutover.

## Pipeline
1. Scout: poll licensed/allowed RSS, official sources, and watchlists; retain URL, timestamp, publisher, source hash; enforce source limits and backoff.
2. Analyst: canonicalize URLs; cluster same event; record source independence, factual claims, corroboration, geography, significance, risk, and provenance.
3. Editor: Claude drafts only qualified stories; claim-to-source mapping, attribution, source dates, and concise analysis. No invented sources or unverified facts.
4. Policy gate: deterministic mandatory checks plus editorial risk classification. AI confidence never overrides missing evidence.
5. Notion: editorial system of record; approved status is sole input to publication. One canonical story may have multiple regional/theme tags, but one canonical published URL.
6. Publication bridge: idempotent Notion-to-site reconciliation, content hash/change detection, build lock, verification, retry, alert; never invoke LLM on a no-change run.
7. Delivery: daily release and brief only after verified publication; breaking news uses controlled exceptional release.

## Hybrid autonomy
Auto-eligible only when: primary official source or multiple genuinely independent reliable corroborations; low-risk non-disputed factual claim; complete source and publication metadata; no allegations/casualty/war/security sensitive details; no conflicting reports; no previously rejected event; editorial policy gate passes. Any failure => Unverified/manual review. Manual approval is required for military conflict, casualty counts, criminal allegations, political disputes, leaks, and consequential disputed claims. Automatic approval is opt-in, disabled until shadow testing and explicit production approval.

## Story state machine
DISCOVERED -> EVIDENCE_PENDING -> QUALIFIED -> DRAFTED -> POLICY_CHECKED -> (AUTO_ELIGIBLE | REVIEW_REQUIRED) -> READY_TO_POST -> PUBLISHING -> PUBLISHED -> LIVE_VERIFIED.
Failure: RETRYABLE_FAILURE -> retry with bounded exponential backoff; terminal -> UNVERIFIED. REJECTED and DELETED never auto-reenter. Use tombstones keyed by canonical event fingerprint and source IDs to prevent resurfacing; tombstones contain no article body.
Allowed transitions are atomic and audited. No implicit status changes by build jobs.

## Data model
event_id, canonical_story_id, source_id, source_url, source_published_at, discovered_at, content_hash, event_fingerprint, independent_source_group, claim_evidence[], region_tags[], theme_tags[], severity, editorial_risk, decision_reason, decision_actor, approval_timestamp, notion_page_id, notion_status, published_url, publication_hash, last_verified_at, retry_count, job_id, workflow_version. Credentials must be in secret storage, never in repository.

## Scheduling
Lightweight source discovery approximately every 30 minutes, with event-triggered AI analysis. Preserve the existing independent 30-minute Ready-to-Post checker until replacement passes parity tests. One normal 09:00 Dubai release and 10:00 brief, subject to verifying current production schedules. No-change => no build. Concurrency locks and idempotency required.

## Acceptance gates
0 duplicate publications; 0 unsupported source links; 0 deleted story resurrections; 100% sensitive stories manual-gated in test fixtures; publication idempotent under retries; no change produces no build; 99%+ approved-content publication success in pilot; measurable cost per published signal; rollback tested. Targets are aspirational until benchmarked.

## Rollout
A. Inventory production dependencies and establish baseline. B. Shadow-run without Notion writes or deploys. C. Compare coverage, errors, source quality and spend. D. One-region controlled cutover after explicit approval. E. Gradually retire old schedules. F. Connect Netlify and verify production only when owner is ready.
