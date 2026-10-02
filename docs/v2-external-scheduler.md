# V2 external scheduling

Netlify's production scheduled function dispatches the existing GitHub Actions workflows in XyLyX/navvyasignal-v2. Research, Notion publishing and content refresh remain in that repository. The scheduler makes no AI calls and does not send email or WhatsApp.

## Dubai schedule
| GST | Run |
| --- | --- |
| 03:30 | Technology & AI |
| 04:30 | Maritime, Energy & Supply Chains |
| 05:30 | Markets & Capital |
| 07:30 | West Asia |
| 08:30 | Global Politics |
| 13:30 | UAE |
| 17:30 | India |
| 21:30 | Homepage selection |
| Sunday 19:15 | Weekly synthesis |

Approved-content comparisons run at :00 and :30 UTC and build only when public content changes. Daily sending remains on its separate, existing GitHub schedule.

## Credentials and rollout
The GitHub fine-grained token is stored only in Netlify as V2_GITHUB_ACTIONS_TOKEN; its repository permission is Actions read/write for navvyasignal-v2. Never copy a masked value returned by a connector into the secret or delete the secret to change its scopes. Configure Production and Functions scope through the Netlify UI.

Non-secret mode and cutover time are versioned in navvyasignal-v2-starter/src/lib/scheduler-rollout.ts. Both the scheduler function and ownership endpoint use the same configuration. Initial connectivity was checked in probe mode, which dispatches v2-scheduler-probe.yml without AI, Notion writes, builds or sends. Activate only after the probe succeeds and no editorial jobs are running. Live cutover is 2026-10-02T22:30:00Z (03 October 02:30 Dubai); earlier slots are not replayed.

Environment overrides V2_SCHEDULER_MODE and V2_SCHEDULER_START_AT remain available. New environment values require a published production deployment. The connector's environment write acknowledgements have not reliably reflected persisted values; verify the actual environment and endpoint after any UI change.

## Ownership and duplication
/api/scheduler-status returns version 1 and active true only when the production function has a token, live mode and a reached cutover boundary. Native GitHub cron jobs consult this endpoint before checkout and skip work while it is active. GitHub workflow_dispatch jobs continue normally. A 404 preserves cron during first rollout; other endpoint failures fail cron preflight rather than risk duplicate paid work.

A site-scoped, strongly consistent Blobs store holds atomic conditional claims per Dubai day/run and per half-hour refresh. Repeated timer invocations do not duplicate a claimed slot. A ten-minute catch-up window tolerates short timer delays without replaying old research. Explicit edition_date is passed to homepage selection.

A rejected or ambiguous dispatch retains its claim. Check GitHub runs and function logs before clearing a claim or manually retrying. An accepted dispatch is not proof of successful publication: verify the downstream workflow and deployed public-content snapshot.

## Rollback and limits
Set the versioned mode to off and publish (or use the environment override and publish). Verify the ownership endpoint reports active false; native GitHub cron resumes. Preserve dispatch history.
This removes dependence on GitHub scheduled-event delivery. GitHub runner queues and failures can still delay or prevent execution; there is no exact-time guarantee.
