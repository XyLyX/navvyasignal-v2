# Verified V2 workflow audit — 27 October 2026
Source: GitHub release/v2-english .github/workflows listing and file reads. This does not establish which workflows execute in production.

## Enumerated workflow files (12)
v2-daily-release.yml; v2-daily-send.yml; v2-editorial-action.yml; v2-editorial-formats.yml; v2-editorial-pipeline.yml; v2-manual-desk.yml; v2-preview-validation.yml; v2-queue-maintenance.yml; v2-review-page.yml; v2-scheduler-probe.yml; v2-static-refresh.yml; v2-whapi-diagnostic.yml.

## Inspected triggers
- v2-editorial-pipeline.yml: four cron entries for 02:30, 04:00, 05:30, 07:00 Dubai; V2_PIPELINE_ENABLED gate; external scheduler ownership check; Anthropic, Gemini, Notion and Whapi environment references; pipeline/main.py.
- v2-daily-release.yml: 05:00 UTC / 09:00 Dubai cron; scheduler ownership check; regional_release.py; Notion, build hook and Whapi.
- v2-daily-send.yml: 06:00 UTC / 10:00 Dubai cron; sender feature flags; verification then main.py delivery; Kit and Whapi.
- v2-static-refresh.yml: manual workflow_dispatch only; default dry-run; explicit publish_now for exceptional release.
- v2-queue-maintenance.yml: manual dispatch only; dry-run default; tests and optional queue checks.
- v2-scheduler-probe.yml: manual dispatch only; diagnostic echo, no publication.

## Cleanup conclusions
Do not delete the daily release, send or static refresh until V3 publication parity and Netlify scheduler ownership are established. Keep queue maintenance until replacement recovery tests pass. Scheduler probe is a candidate for later removal, but external integrations may still dispatch it. Other six workflows require content inspection before classification. Gemini appears in V2 editorial environment and may still be called by pipeline/main.py; inspect call sites before removal.

## Critical GitHub constraint
GitHub scheduled workflows run on the repository default branch only, not on release/v2-english merely because the cron YAML exists there. Therefore inspect main branch, external dispatch and Netlify scheduler ownership before concluding which schedules are live. Source: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows

## V3 additions
v3_core/scout.py: bounded offline RSS/Atom ingestion with allowlist.
v3_core/analyst.py: conservative evidence bundle and four-region routing.
v3_core/editor.py: fail-closed candidate preparation; no LLM or Notion side effects.
tests/test_v3_pipeline.py: isolated fixtures.
No existing workflow has been removed; no live calls have been made.
