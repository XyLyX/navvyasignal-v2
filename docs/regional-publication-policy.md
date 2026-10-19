# NavvyaSignal regional publication policy — regional-v1

This replaces ALL earlier desk, refresh, homepage and delivery schedules.
Source of truth: `navvyasignal-v2-starter/src/lib/regional-policy.json`.

| Dubai time | Action |
|---|---|
| 02:30 | North America — US first |
| 04:00 | Europe — UK and continental Europe |
| 05:30 | India & Subcontinent — India first |
| 07:00 | UAE & Middle East — UAE first |
| 09:00 | Release verified staged stories, select homepage, request ONE production build, verify public snapshot |
| 10:00 | Compile Daily Brief and WhatsApp channel message from the verified edition |

Every desk covers all themes: politics, geopolitics, economy, markets, capital, technology,
AI, energy, maritime, supply chains, business, science, society and significant happenings.
Trending hashtags and permitted feeds are discovery inputs, not evidence or quotas.
No commercially restricted RSS ingestion without permission.

## Editorial states

- Verified automatic desk result: `Ready to Post=false`, Internal Note starts `V2_RELEASE_PENDING:`.
- Unverified/rejected result: `Ready to Post=false`, Internal Note starts `V2_UNVERIFIED_SIGNAL:`;
  retained privately, WhatsApp self-alert with desk/headline/reason/review link. Never auto-approved or auto-deleted.
- Manual Claude review: after source review ask the user to choose **Ready to post now**,
  **Ready to post scheduled**, or **Delete**. Do not equate approval with immediate publication.
- Scheduled: stage for the next 09:00 Dubai release. It stays unchecked until release.
- Now: explicit exceptional build authorization; verify the saved result live.
- Delete: Notion Trash, not a hidden queue record. Never delete already-public stories through the private queue.

Claude can use GitHub workflow `v2-editorial-action.yml` with page_id, action, desk and resolution.
The authenticated private queue exposes the same three actions. If using Notion directly,
never merely check Ready to Post for a scheduled approval: use the workflow to write the release marker.
No raw sync flag, Framer update, half-hour refresh or desk-run deployment is permitted.

## Safety and cutover

Both the Netlify timer and GitHub fallback load the four-desk policy. GitHub fallback cron
is guarded by external scheduler ownership. Old desk keys are rejected; no earlier weekly
or homepage schedule remains active. Synthesis is manual and stages for the next release.
Historical published articles/categories stay intact; they are not new active desks.
Scheduled Notion updates use new private staging records; current public articles stay intact.
A release ledger persists build requests before external side effects, so a verification
failure cannot blindly trigger another deployment. An ambiguous request needs reconciliation.
Do not replay historical workflows, research missed slots, approve held stories or send test
messages as part of cutover. One configuration deployment activates the new timer and controls.
