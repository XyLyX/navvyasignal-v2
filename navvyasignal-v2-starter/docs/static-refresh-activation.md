# V2 static refresh — staged, not active

The V2 preview uses Next.js `output: 'export'`: all Notion reads and the Dubai publication date are evaluated during the build. A build is necessary for Notion edits and midnight rollover to appear. No ISR is active.

## Automated checks

`.github/workflows/v2-preview-validation.yml` runs unit tests, TypeScript and a credential-free static build on pushes to `notion-readonly`. Tests cover the Dubai midnight boundary, approval gate, manual checkbox, exact date, numeric ordering, stable ties, seven-story limit and no yesterday fallback. A separate real-token preview deployment must validate live Notion integration.

## Refresh staging

`.github/workflows/v2-static-refresh.yml` is staged on the draft branch. GitHub Actions scheduled workflows run only on the default branch, so the schedule is not active until a separately approved merge. The workflow requires a GitHub Actions `v2-preview` environment and `V2_NETLIFY_BUILD_HOOK` secret containing a build hook created specifically for the isolated `navvyasignal-v2-preview` Netlify site. Never use a Framer/V1 hook or a Rate Manifest hook. Do not paste the URL into GitHub source, Notion or chat.

After the secret and environment are configured, manually dispatch the workflow, confirm it queues a build on the isolated site, and verify the preview renders approved dated stories. Only then approve merging the workflow to the default branch to activate the schedule. The schedule requests a rebuild every four hours at 00:10, 04:10, 08:10, 12:10, 16:10 and 20:10 UTC, corresponding to 04:10, 08:10, 12:10, 16:10, 20:10 and 00:10 Dubai time. GitHub cron is best-effort and may be delayed; the webhook response proves only queuing, not deployment success.

## Editorial preconditions

Notion has `Homepage Date` and `Homepage Priority`. Homepage picks may be made by the automation (which also ticks `Auto Selected`) or by an editor: `Ready to Post`, `Today's Intelligence`, a Dubai `Homepage Date` and a positive numeric priority. The homepage shows the latest such edition (rolling, see homepage-editorial-contract.md). Every approved V2-era story is published to its desk, Signals and article route regardless of homepage selection.

No production cutover, V1 changes, Kit sends or WhatsApp operations are part of this workflow.

See also [rss-integration.md](rss-integration.md): the six-feed RSS importer runs during the same build, so this refresh workflow also picks up new Navyaa and network articles with no further change.


## Proposed refresh strategy (PROPOSAL, not active; the schedule above is unchanged)

Observed automation timing (26 Sep logs): desk runs start between 06:34 and 16:34 UTC and `compile_send`, which writes the homepage selection, started at 17:43 UTC (21:43 Dubai) although scheduled for 14:03 UTC. GitHub cron delays of several hours are normal, so clock-based builds cannot line up with the selection.

1. **Event-driven build request after the Notion stage of `compile_send`, independent of distribution.** In the automation, `run_compile_send()` runs selection, Cross-Desk and Watchlist (all Notion writes) and only then `send_kit`, `verify_kit_sent` and `send_whapi`; a Kit or Whapi failure calls `fail_hard` and ends the Python process non-zero. So the request must not live in the Python send path or depend on the job's success:
   - **Marker:** right after the Notion stage (before `send_kit`) the script would append `notion_stage_complete=true` to `$GITHUB_OUTPUT` (or print one fixed log line). Selection failing softly still counts as complete, since its failure is already non-fatal.
   - **Separate workflow step:** placed after "Run briefing script" with `if: always() && steps.runbriefing.outputs.notion_stage_complete == 'true' && steps.runtype.outputs.dry_run != 'true'`, `continue-on-error: true`, `timeout-minutes: 2`, needing only the V2 hook secret (no Kit/Whapi secrets). It POSTs the build hook with `curl --fail --max-time 30 --retry 2`, and its own failure never fails the job or the ops notification.
   - **Why a step and not in-process:** the step runs even when Kit or Whapi fail (the same `always()` pattern the "Commit run log" step already uses); a slow or failing hook cannot delay or block distribution; and the send code stays untouched.
   - **Not requested when the Notion stage never finished** (e.g. compile failed, credit lapse): nothing new to publish, and the safety-net schedule below covers desk-run articles.
   - Automation-side change, so out of scope of this V2 patch; it needs a separate approval.

   | Failure | Build requested? |
   |---|---|
   | Kit send fails (`fail_hard`) | yes: the step runs after the failed Python step |
   | Whapi send fails (`fail_hard`) | yes |
   | Selection / Cross-Desk / Watchlist raises (already non-fatal) | yes: marker is still set |
   | Compile fails before the Notion stage | no: safety-net schedule covers it |
   | Build-hook POST fails or times out | no build from this trigger; job stays green; safety-net schedule covers it |
   | Netlify build itself fails | previous deploy stays live; check deploy status separately |
2. **Safety-net schedule in this workflow (about 3 per day)**, e.g. 03:10, 11:10 and 19:10 UTC (07:10, 15:10, 23:10 Dubai). It picks up morning desk runs, manual approvals and any missed event-driven build.
3. **Drop the midnight-rollover build.** The rolling edition has no midnight cliff, so it is no longer needed. Total is about 4 builds/day instead of 6, and none depends on GitHub cron punctuality.
4. Refresh stays best-effort and independent of distribution in both directions: neither a Kit/Whapi failure blocks the build request, nor a build-hook failure affects sends. Keep the existing safeguards: `concurrency` group, `if: github.repository` guard, hook-format validation and dry-run default for manual runs. A queued hook proves only queuing, so check deploy status separately. Notion or credential failures fail the build and leave the previous deploy live.

## Settings that must be verified outside the repository

GitHub
- `main` (default branch) has **no** workflows (last commit 23 Sep), so no schedule runs until the workflow is merged there.
- Actions environment `v2-preview` exists, with secret `V2_NETLIFY_BUILD_HOOK` (URL format `https://api.netlify.com/build_hooks/<id>`) created for the isolated V2 site only.
- Branch protection / required checks on the branch Netlify builds; `v2-preview-validation` status (three homepage/venture tests were already failing before this patch).
- If proposal 1 is adopted: the same hook as a secret in the automation repo.

Netlify (site `navvyasignal-v2-preview` / the site serving navvyasignal.com)
- Which site and branch serve production, and which branch the build hook builds.
- Whether auto-publishing is locked (Deploys → "Stop auto publishing"/locked deploy). This is the setting that decides if successful builds go live without a manual "Publish deploy".
- Build environment variables `NOTION_TOKEN` and `NOTION_DATA_SOURCE_ID` for every context that builds (production, branch deploys, deploy previews); optional `V2_PUBLICATION_START`, `V2_CURRENT_STORY_IDS`.
- Base directory `navvyasignal-v2-starter`, build command `npm run build`, publish dir `out`, Node version.
- Failed-deploy notifications, and that previous deploys are retained (rollback).

Notion
- The integration can read the data source, and the properties `Ready to Post` (checkbox), `Today's Intelligence`, `Homepage Date`, `Homepage Priority`, `Content Type` keep their exact names and types. The build now filters on `Ready to Post` server-side; a rename fails the build (HTTP 400) rather than publishing nothing.
