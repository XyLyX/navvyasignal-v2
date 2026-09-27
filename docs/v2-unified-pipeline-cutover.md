# V2 unified pipeline cutover

## Scope

`pipeline/main.py` runs the seven isolated desks, Friday synthesis, daily compilation,
Notion writes, Kit and Whapi. It is a self-contained V2-owned migration of the working
editorial engine, with Framer writes removed. Its V2 selection writes `Today's Intelligence`,
Dubai `Homepage Date`, and positive `Homepage Priority`. Compilation paginates all approved
Signals created on the current Dubai day. `v2-editorial-pipeline.yml` requests a V2 rebuild
after the Notion stage even if a later send fails; `v2-static-refresh.yml` is an optional
once-daily safety net. No runtime job calls the old repositories or Framer.

The compilation runs at 23:15 Dubai time. On 2026-09-27 the live database had
approved desk entries created between 19:17 and 20:36 Dubai, after the old
18:03 compilation slot. The later time allows these delayed desk runs to join
the same day's edition.

The copied editorial research and provider adapters still need a separate quality review;
moving their ownership does not improve their factual accuracy. In particular, Gemini
verification can make erroneous objections. Each generated article remains subject to
the publication's factual checks.

The V2 editorial prompt now requires dated direct source URLs, event/trading-date
precision, explicit attribution, and complete short briefs. A batch with any
missing source URL or overlong brief fails before Notion writes. An unavailable
Gemini review also stops a live desk run. These structural gates do not prove
that a linked source supports every claim; editorial spot checks remain necessary.

Netlify build credits are limited. Use a local synthetic build and one read-only
Notion reconciliation before requesting a single isolated preview build. Keep
`V2_REFRESH_ENABLED` false through validation. After cutover, prefer the
post-publication hook; keep `V2_REFRESH_SAFETY_NET_ENABLED` unset unless its
once-daily credit cost is acceptable. No preview or production deploy is part of this change.

## Activation gates

1. Inspect `feature/v2-unified-pipeline` and the feature branch containing the V2 publication
   bridge. Run Node tests, typecheck, Python tests and a credential-free synthetic build.
2. Perform one **local read-only** build with the real Notion data source; reconcile homepage,
   desk and article counts. Check the Netlify site, deploy branch, production domain, and
   auto-publishing lock. `NOTION_DATA_SOURCE_ID` belongs to the website build;
   `NOTION_DATABASE_ID` belongs to the Python writer. Do not interchange them.
3. In the V2 repo, configure the existing provider secrets by name: `ANTHROPIC_API_KEY`,
   `NOTION_API_KEY`, `NOTION_DATABASE_ID`, `GEMINI_API_KEY`, `KIT_API_KEY`, `KIT_FROM_EMAIL`,
   `WHAPI_TOKEN`, `WHAPI_CHANNEL_ID`, `OPS_NOTIFY_NUMBER`. The preview build hook must
   be `V2_NETLIFY_BUILD_HOOK` and must point only at the isolated V2 preview site.
   Do not copy secret values into git or logs. Keep `V2_PIPELINE_ENABLED` and
   `V2_REFRESH_ENABLED` unset initially.
4. Merge the validated branch to the default branch only after approval. A manual dry run
   suppresses Notion writes, Kit, Whapi, and refresh. Compare its desk output against Notion.
5. At one agreed daily boundary, disable the old `navvyasignal-automation` workflow **before**
   setting `V2_LEGACY_SENDER_DISABLED=true` and `V2_PIPELINE_ENABLED=true`. Both variables are required by the scheduled job. Enable `V2_REFRESH_ENABLED=true` only after the V2
   hook, credentials, and target branch have been verified. This order prevents duplicate sends.
6. Observe all seven desk runs, exactly one Kit and Whapi send, and a successful V2 preview
   rebuild whose article counts match the day's Notion records. Confirm that no Framer sync
   property changed. Keep the old repository archived and restorable through this cycle.

## Current blockers

- Repository and Netlify secrets and deployment settings cannot be verified from public git.
- GitHub schedules run from the default branch only; staged workflows do not run on a timer.
- Old automation is still active. Do not enable V2 sending until the old job is disabled.
- The static V2 website cannot show new posts until a successful build with real read-only
  Notion credentials occurs. A queued build hook alone is not proof of deployment.
- Live Signal Feed inspection on 2026-09-27 confirmed the three homepage properties
  exist, but selected entries had no Homepage Date or Homepage Priority. The
  22:44 Dubai West Asia entry was Ready to Post and not Synced to Framer.
- There is no automated per-day idempotency ledger for Kit or Whapi. The V2 job blocks a
  GitHub rerun attempt of `compile_send`; operators must not dispatch an extra non-dry
  `compile_send` for a date that has already been sent.

## Rollback

Set `V2_PIPELINE_ENABLED=false`, then restore the old workflow only after confirming V2
cannot send. Set `V2_REFRESH_ENABLED=false` to stop refresh requests. Preserve the last
known-good website deploy. Never run both senders with production credentials simultaneously.
