# Homepage editorial contract (rolling edition)

The existing Notion Signal Feed properties `Ready to Post`, `Today's Intelligence` (checkbox), `Homepage Date` (date) and `Homepage Priority` (number) drive the homepage. `Auto Selected` (checkbox, written by the automation to tell its own picks from manual ones) is ignored by V2. V2 reads Notion only.

## Publication is separate from homepage selection

- **Publication:** every approved story (`Ready to Post`) from the V2 era is published to its desk page, the Signals archive and its own `/signals/<id>` route, with or without homepage metadata. No allowlist is involved.
- **Homepage:** `Today's Intelligence` + `Homepage Date` + `Homepage Priority` control only the curated "Today's Intelligence" edition.
- **`V2_CURRENT_STORY_IDS`** (comma-separated Notion page IDs) is an additive exception only: it publishes specific older approved records. It never hides or restricts other stories.

## Publication cutoff (temporary migration boundary)

The database still holds the historical Framer-era corpus, all with `Ready to Post` ticked, and Notion's creation timestamp is not a publication date. Until that corpus is audited (see v2-3-legacy-article-audit.md) and its home is decided, V2 publishes a story only if it:
- was created on or after the publication start, **25 Sep 2026 (Dubai calendar day)**, or
- carries a `Homepage Date` on or after it, or
- is listed in `V2_CURRENT_STORY_IDS`.

This is a **migration boundary, not an editorial rule**. `V2_PUBLICATION_START=YYYY-MM-DD` moves it (default `2026-09-25`; `1970-01-01` disables it) without a code change. Remove or lower it when the legacy corpus has been audited and a decision is recorded for each part of it (stay in the V1 archive, migrate to V2, or unapprove in Notion). Do not lower it merely to surface a single older article; use `V2_CURRENT_STORY_IDS` for that.

### Watchlist exception (retained)

`/watchlist` and the homepage Watchlist aside list approved Watchlist stories without the cutoff, because ongoing developments may predate V2, and every card links to `/signals/<id>`. Applying the cutoff to routes alone would create dead links; applying it to the Watchlist surfaces would silently drop ongoing items. So Watchlist stories keep a **route only**: they are never added to desks, the Signals archive, the homepage edition or the editorial panels unless they are V2-era. If a Framer-era Watchlist record should not appear, fix it in Notion (untick `Watchlist` or `Ready to Post`), not in code.

## Rolling edition

1. Candidates: approved stories with `Today's Intelligence` ticked and a valid `Homepage Date` that is not in the future (Dubai date at build time).
2. The edition is the **latest candidate date**, and only that date. Dates are never combined.
3. Up to **seven** stories from that edition, ordered by `Homepage Priority` ascending. Unset/invalid priorities follow numbered ones; ties: newest creation date, then page ID. No per-desk quota.
4. No hard expiry. If the newest edition is older than today it stays on the homepage until a newer one exists. The homepage shows the real edition date and labels it "Today's edition" or "Latest edition".
5. A newer edition that is only partially populated is shown as it stands (not padded from an earlier date). The automation writes a whole edition within seconds; a build landing inside that window is the only way to see a partial one.
6. No edition at all: explicit empty state; desk pages, Signals and article routes are unaffected.

The date is evaluated at static-build time. Edits in Notion appear only after a new build (see static-refresh-activation.md).

## Editorial panels

Cross-Desk, Briefing and Long Read panels show the latest published story of that `Content Type`, independent of homepage selection.

## Validation checklist

- Tests: `npm test` (`tests/v2-publication.test.cjs`, `tests/notion-ingestion.test.cjs`), `npm run typecheck`, credential-free CI build.
- Optional end-to-end check with synthetic Notion data: `NODE_OPTIONS="--require ./tests/helpers/mock-notion-build.cjs" NOTION_TOKEN=mock NOTION_DATA_SOURCE_ID=mock npm run build`.
- Real-credential preview: check the built page counts, the edition date shown and one non-selected article's route before publishing.
