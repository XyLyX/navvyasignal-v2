# V2 static refresh — staged, not active

The V2 preview uses Next.js `output: 'export'`: all Notion reads and the Dubai publication date are evaluated during the build. A build is necessary for Notion edits and midnight rollover to appear. No ISR is active.

## Automated checks

`.github/workflows/v2-preview-validation.yml` runs unit tests, TypeScript and a credential-free static build on pushes to `notion-readonly`. Tests cover the Dubai midnight boundary, approval gate, manual checkbox, exact date, numeric ordering, stable ties, seven-story limit and no yesterday fallback. A separate real-token preview deployment must validate live Notion integration.

## Refresh staging

`.github/workflows/v2-static-refresh.yml` is staged on the draft branch. GitHub Actions scheduled workflows run only on the default branch, so the schedule is not active until a separately approved merge. The workflow requires a GitHub Actions `v2-preview` environment and `V2_NETLIFY_BUILD_HOOK` secret containing a build hook created specifically for the isolated `navvyasignal-v2-preview` Netlify site. Never use a Framer/V1 hook or a Rate Manifest hook. Do not paste the URL into GitHub source, Notion or chat.

After the secret and environment are configured, manually dispatch the workflow, confirm it queues a build on the isolated site, and verify the preview renders approved dated stories. Only then approve merging the workflow to the default branch to activate the schedule. The schedule requests a rebuild every four hours at 00:10, 04:10, 08:10, 12:10, 16:10 and 20:10 UTC, corresponding to 04:10, 08:10, 12:10, 16:10, 20:10 and 00:10 Dubai time. GitHub cron is best-effort and may be delayed; the webhook response proves only queuing, not deployment success.

## Editorial preconditions

Notion has `Homepage Date` and `Homepage Priority`. Do not automatically select or backfill records. Editors must set `Ready to Post`, `Today's Intelligence`, today's Dubai `Homepage Date` and positive numeric priority. With no dated selections the homepage intentionally shows an empty state. Approved desk/archive records remain visible.

No production cutover, V1 changes, Kit sends or WhatsApp operations are part of this workflow.

See also [rss-integration.md](rss-integration.md): the six-feed RSS importer runs during the same build, so this refresh workflow also picks up new Navyaa and network articles with no further change.
