# NavvyaSignal production stabilization — 2026-11-17

Scope: owner-authorized stages 1–6. Historical V1 archive is explicitly OUT OF SCOPE and PR #34 must remain unmerged.

## Evidence from GitHub Actions
- 2026-11-16 regional North America editorial run 43769637214 failed in "Research, verify and stage for 09:00": `ValueError: Drafts and included candidate decisions disagree` from `pipeline/desk_discovery.py:280`. This is a fail-closed editorial consistency check, not evidence that an unverified draft was published. Log also reports deprecated `claude-sonnet-4-5`; inspect effective model configuration and per-run overrides.
- 2026-11-16 regional release 43807435867 failed with `Edition incomplete; desk runs not completed: north_america`.
- 2026-11-16 daily send 43813847695 failed its pre-delivery gate with the same missing desk. The run's alert step reports acceptance by connected Whapi. This is a cascading upstream failure, not three independent delivery bugs.
- Recent 2026-11-17 regional, release, Notion refresh, editorial-format and send workflow runs report success. Green workflow conclusions alone do not prove delivery receipts or content accuracy.

## Production safety decisions
1. Preserve fail-closed release and send gates; NEVER bypass a missing desk to force a green release.
2. Reproduce and fix the discovery draft/decision disagreement with a deterministic fixture and tests. Check excluded candidates and the actual included-draft set, not merely list lengths.
3. Verify the effective Claude model from workflow configuration and runtime logs; remove deprecated overrides only after a controlled test.
4. Confirm a successful rerun or later completed edition has a durable per-desk receipt; confirm release and send receipt idempotency.
5. Keep all existing workflow triggers until cron owners and dependencies are reconciled; no destructive cleanup.
6. Validate editorial source-to-claim checks, approval-only Notion refresh, corrections and duplicate protection with negative tests.
7. Treat V3 PR #32 as design/shadow code, not deployed production. Validate isolated V3 tests, persistent ledger design and shadow-to-live cutover before integrating.
8. Obtain Netlify site identity and published SHA; current connected Netlify project search returned no match. Do not claim live deploy verification.
9. Confirm delivery-provider acceptance separately from end-recipient delivery, and obtain billing usage before claiming cost optimization.

## Exit gates (not yet satisfied)
- Stage 1: reproducible regression test for the upstream mismatch; failed desk -> release -> send fail-closed behavior and recovery verified.
- Stage 2: source/claim, dedupe, hold, correction, approval and audit tests pass; editorial style sheet enforced.
- Stage 3: V3 tests pass and shadow outputs reconciled with V2 before production switch.
- Stage 4: one accountable schedule map and no redundant active triggers; rollback documented.
- Stage 5: Netlify published SHA, route/mobile/Notion freshness acceptance evidence.
- Stage 6: receipt-level delivery audit, alert test, failure replay, and measured cost baseline.

No archive migration, live workflow deletion, Notion mutations, subscription actions, or deployment performed by this audit.
