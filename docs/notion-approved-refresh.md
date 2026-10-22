# Approved Notion publication refresh

The independent GitHub workflow `v2-notion-refresh.yml` checks every 30 minutes
(`*/30 * * * *`). GitHub may delay scheduled jobs.

It reads every checked **Ready to Post** record, with pagination, and compares
public IDs and content digests against `/publication-state`. No change means no
build. New approvals, public edits, unchecked approvals and deletions trigger a
build only when they change that snapshot. The site's existing publication
eligibility rules and separate homepage selection still apply.

This path does not approve drafts, release scheduled approvals, rank stories,
research, call any AI provider or send email/WhatsApp. Unchecked scheduled stories
remain held until their existing release process checks Ready to Post.

It shares `regional-publication` concurrency with daily and immediate publication.
A private unchecked system receipt in Notion records the build request before the
hook is called. An ambiguous or timed-out request is verified again without
blindly issuing a second build. Inspect Netlify if a receipt remains pending.
Restoring a previously verified snapshot can start a new build.

Manual dispatch defaults to dry run. The 09:00 daily release and four desk times
are unchanged. Each changed snapshot still incurs normal Netlify build usage.
