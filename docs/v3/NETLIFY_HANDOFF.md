# Netlify Connection Handoff
Do not deploy or alter Netlify while owner works on another project.

When connected:
1. Confirm Netlify team and project for navvyasignal.com and preview; record site IDs without exposing secrets.
2. Confirm domain routing, production branch and published commit SHA.
3. Read build configuration, functions, hooks, schedules and environment variable NAMES (never print values).
4. Compare GitHub cron workflows with Netlify jobs and external automation triggers.
5. Test publication bridge in nonproduction with a fixture; no-change must produce no build.
6. Validate Notion Ready-to-Post -> published -> live verified and failure recovery.
7. Approve cleanup PR and phased cutover separately; do not merge or deploy implicitly.

Rollback: keep prior production commit, Notion schema compatibility, and last-known-good publication manifest until post-cutover validation.
