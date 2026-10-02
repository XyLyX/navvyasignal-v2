# V2 external scheduling
Netlify's production scheduled function triggers existing Actions workflows in the same V2 repository.
The function runs every five minutes. It makes no AI calls and never directly sends email or WhatsApp.

## Agreed Dubai schedule
| GST | Run |
| --- | --- |
| 03:30 | technology_ai |
| 04:30 | maritime_energy |
| 05:30 | markets_capital |
| 07:30 | west_asia |
| 08:30 | global_politics |
| 13:30 | uae |
| 17:30 | india |
| 21:30 | site_only |
| Sunday 19:15 | weekly_synthesis |

Approved content comparison runs at :00 and :30 UTC, deploying only when content changes.
Daily sending remains in its separate workflow and retains its existing schedule.

## Activation
1. Create a GitHub fine-grained personal access token, resource owner XyLyX, restricted to navvyasignal-v2, repository permission Actions: read and write. Set an expiry and record a rotation reminder.
2. Save it in Netlify project navvyasignal-v2-preview as secret V2_GITHUB_ACTIONS_TOKEN, production context, Functions scope. Never put it in source or chat.
3. Set V2_SCHEDULER_MODE=probe in production Functions scope and publish the deployment. The next five-minute invocation dispatches v2-scheduler-probe.yml, which does no AI research, Notion writes, site refresh or sending. Check that this workflow reaches success.
4. Confirm there are no running editorial jobs before cutover. Set V2_SCHEDULER_START_AT to a future ISO UTC timestamp at a five-minute boundary and V2_SCHEDULER_MODE=live; publish the deployment. Slots before this boundary are not replayed.
5. Verify /api/scheduler-status returns version 1, active true. At this boundary GitHub cron jobs consult this endpoint and skip paid work. Workflow dispatch jobs continue. Verify the next expected dispatch and its publication result.

Environment changes need a newly published production deployment for Functions to receive them.
Missing token, missing start time or mode other than live/probe keeps external dispatch off.
The live ownership endpoint must be reachable: non-404 network/HTTP errors fail cron preflight rather than risking duplicate paid work. A 404 preserves the old cron during initial rollout.

## Duplicate and failure behavior
A site-scoped strongly consistent Blobs store holds one atomic claim per Dubai date/run type, and one per half-hour refresh. Conditional create prevents two simultaneous invocations dispatching the same slot.
A ten-minute catch-up window tolerates brief scheduler delays. It does not backfill a day of missed research.
A failed or ambiguous dispatch retains its claim. Do not delete it until checking GitHub for a corresponding run. Inspect function logs and the Blobs entry; manually rerun only if no dispatch was accepted.
GitHub Actions queueing remains possible: moving the timer eliminates dependence on GitHub scheduled-event delivery, not all runner delays.

## Rollback
Set V2_SCHEDULER_MODE=off and publish. Verify /api/scheduler-status active false; native GitHub cron resumes. Do not erase dispatch history.
