# Publication decoupling: controlled migration

Status: design and regression preparation only. NOT deployed. Existing editorial approval, publication lease, and delivery gates remain authoritative until cutover is verified.

## Invariants
1. No unapproved, unverified, or unstaged story can become public.
2. No AI model call is required to publish an already frozen and approved edition.
3. Each edition has an immutable snapshot and content hash; revisions require a new edition version and approval.
4. Website, email, and WhatsApp consume the same edition version independently.
5. Provider timeouts are ambiguous, never proof of failure. Reconcile external receipts before retrying.
6. A last-known-good public snapshot remains served if Notion, AI, scheduler, or database is temporarily unavailable.
7. Keep the existing PostgreSQL publication lease until a tested atomic replacement exists.

## Proposed PostgreSQL tables (migration not yet applied)
- publication_editions: edition_id, edition_date, version, status, content_hash, approved_at, approved_by, frozen_at, published_at; unique (edition_date, version).
- publication_entries: edition_id, source_page_id, ordinal, payload_json, payload_hash; unique (edition_id, source_page_id).
- publication_outbox: event_id, edition_id, channel, status, attempt_count, next_attempt_at, lease_until, idempotency_key, last_error; unique (edition_id, channel, idempotency_key).
- delivery_receipts: event_id, provider, provider_message_id, delivery_state, confirmed_at; unique (provider, provider_message_id).
- publication_audit: append-only actor, action, edition_id, prior_hash, new_hash, occurred_at.

## Cutover sequence
1. Inventory live Notion schema, scheduled workflows, production snapshot and lease; record a recovery point.
2. Create schema with RLS and least-privilege service roles. Block public writes and prohibit edits to frozen editions.
3. Backfill historical approved records into a shadow database without publication side effects.
4. Run shadow edition freezing and compare canonical hashes against the current approved publication snapshot.
5. Move ranking to pre-approval; persist full candidate assessments and require exact coverage. Reject any approval after input mutation.
6. Run a shadow deterministic 09:00 release against the frozen edition, with no Netlify hook and no external sends.
7. Introduce channel-specific outbox workers with durable receipts, retries and dead-letter states. Verify duplicate and timeout behavior using mocks.
8. Serve published snapshots without a build; retain last-known-good fallback and explicit cache invalidation.
9. Switch one channel at a time after signed acceptance. Retain rollback to current release path and avoid dual sends.
10. Remove legacy scheduler/Notion live dependencies only after production evidence shows parity and no double publication.

## Required acceptance tests
- Missing, duplicate, unknown, stale, and malformed editorial assessments are rejected.
- Changes after approval invalidate the frozen edition.
- Notion and model outages do not prevent publication of an already frozen approved edition.
- Missing approvals never publish.
- Parallel schedulers cannot publish twice.
- Database outage serves last-known-good and queues sends without losing events.
- Netlify outage does not mutate approved edition state.
- Email and WhatsApp failures are independent, retry safely, and never blindly resend on ambiguous provider responses.
- RSS, Atom, JSON Feed, sitemap, HTML, JSON-LD and public publication-state all reflect the same approved edition.
- Negative publication tests confirm unapproved content absent from all public surfaces.

## Immediate change scope
The ranking validation/retry patch and its offline tests are staged on this branch. They reduce the known model-response failure but do not remove AI from the 09:00 release. Moving AI out of that critical path requires the frozen-edition store and shadow acceptance above; do not skip these gates.
