# V2.8 six-feed RSS integration

A build-time, read-only importer feeds two homepage sections. Nothing is fetched in the browser; the site is still a Next.js `output: 'export'` static build.

| Source | Feed | Shown as |
| --- | --- | --- |
| Navyaa | https://navyaa.blog/feed.xml | A DIFFERENT LENS (latest 3) |
| OM4BIZ | https://om4biz.com/feed.xml | FROM THE NAVVYA NETWORK, Insights |
| D6 Kitchens | https://d6kitchens.com/feed.xml | FROM THE NAVVYA NETWORK, Insights |
| Zen Homes | https://zenhomesglobal.com/insights/feed.xml | FROM THE NAVVYA NETWORK, Insights |
| Zen Homes | https://zenhomesglobal.com/portfolio/feed.xml | FROM THE NAVVYA NETWORK, Portfolio |
| Design Code Studios | https://designcode.ae/insights-feed.xml | FROM THE NAVVYA NETWORK, Insights |

Network sections are separate from Today's Intelligence, Notion records, the Watchlist and independent reporting; they share no data path with `src/lib/notion.ts`. The existing network directory (`/network`, homepage "The Navvya Network" cards) is unchanged.

## Code map (`src/lib/rss/`)

- `sources.ts` – the allowlist. Sources are looked up by id; no caller-supplied URL is ever fetched. Each source lists the hosts allowed for redirects, article links and article images.
- `fetch.ts` – HTTPS fetch with a 10 s timeout, 1 MB cap (declared and streamed), XML content-type check, manual redirects (max 3, each hop must be https on an allowed host, no credentials), and prolog/header charset decoding.
- `parse.ts` – pure normalisation using `fast-xml-parser` (v5). Documents containing `<!DOCTYPE`/`<!ENTITY` are refused (no entity expansion). Supports RSS 2.0 plus basic Atom, and the `media:`, `content:`, `dc:` and `atom:` namespaces.
- `service.ts` – per-source load, deterministic sort, dedupe, and the never-throwing `loadAllFeeds`.
- `src/lib/feeds.ts` – Next.js glue (env switches, fixtures, logging). `src/components/FeedSections.tsx` / `FeedCards.tsx` – display.

## Normalisation rules

- **Title, excerpt**: converted to plain text (scripts, styles, iframes, comments and tags removed, entities decoded once). Feed HTML is never rendered. Excerpts come from `description` (else Atom `summary` / `content:encoded`) and are cut at about 260 characters; an excerpt identical to the title, or empty, is omitted rather than invented.
- **Link**: required; must be `https`, on an allowlisted host, no credentials or non-default port. Fragments and tracking parameters (`utm_*`, `fbclid`, …) are removed. Items with any other link are rejected.
- **Date**: taken only from `pubDate` / `dc:date` / Atom `published` / `updated`, RFC 822 or ISO 8601 with an explicit zone (date-only ISO is UTC). Missing, unparseable, zone-less, impossible (31 Feb) or more than 24 h in the future dates reject the item. Dates are displayed in Asia/Dubai.
- **Image**: only an article-level `media:content` (image), `media:thumbnail` or image `enclosure`, https, on an allowlisted host. Channel-level `<image>`, Open Graph or site images are never substituted. No image means a text-only card with the publication name and content type.
- **Dedupe and order**: unique by canonical URL (host without `www`, no trailing slash, tracking params removed) across all six feeds, earlier allowlist entries winning. Newest first; equal timestamps are ordered by title, then canonical URL, so output never depends on feed order.
- **Encoding**: Navyaa currently serves some excerpts as UTF-8 bytes read as Windows-1252 (an em dash appears as three Latin-1 symbols; 4 of 60 items on 24 Sep 2026). `repairMojibake` fixes a string only if the whole string round-trips as strict UTF-8; anything else is left exactly as published. It is applied to titles and excerpts only, and each repaired item carries `encodingRepaired: true`. Article text is never rewritten (only the excerpt is shown).

## Resilience: explicit empty state, no snapshots

Each source is loaded independently. A feed that lists entries but has every one rejected (status `all-rejected`) is reported separately from a genuinely empty feed: the build logs `[rss] <id>: feed has N entries but all N were rejected (reason=count, …)` using only counts and fixed reason codes, never article text, and the card says no valid articles could be read. A timeout, HTTP error, wrong content type, oversize body, malformed XML or empty feed affects only that source: its group shows an empty state ("could not be reached when the site was last built" or "No published articles are listed yet") with a link to the publication, and the build logs `[rss] <id> unavailable at build: <reason>`. The build never fails because of a feed.

**No last-known snapshot is stored or committed.** This avoids stale content masquerading as fresh; everything displayed was retrieved by the current build, which the section footnote states ("Feeds checked when this page was built, <date>"). If a snapshot is wanted later it must record `retrievedAt` separately from each article's `publishedAt` and be labelled as a snapshot.

## Tests and CI

`npm test` (Node's built-in runner, Node 24 type stripping, no network) runs `tests/homepage-selection.test.cjs` and `tests/rss.test.ts` against `tests/fixtures/feeds/`:
representative XML for all six feeds (`<source-id>.xml`) plus `edge-cases.xml`, `atom.xml`, `empty-feed.xml`, `malformed.xml`, `doctype.xml`. Fetch behaviour (outages, timeouts, oversize, redirects) uses injected `fetch` implementations.

When `CI=true` and `V2_CI_STATIC_FIXTURE=1` (the validation workflow) the build reads those fixtures instead of the network, so CI is deterministic and the section renders with clearly labelled `Fixture:` items. For local verification `V2_RSS_FIXTURES=1` forces fixtures and `V2_RSS_FIXTURES=0` forces live feeds. Production/preview builds have neither flag and fetch the live feeds. As a safeguard, fixtures are never used on a Netlify build (`NETLIFY=true`, `NETLIFY_BUILD_BASE` or `DEPLOY_ID` present) even if `V2_RSS_FIXTURES=1` or the CI flags are set; the build logs a warning and fetches live feeds (`src/lib/rss/env.ts`).

## Making new articles appear automatically

Feeds are read only when a build runs, so new articles appear on the next build of the isolated V2 Netlify site. The existing staged workflow `.github/workflows/v2-static-refresh.yml` already triggers that build every four hours (00:10, 04:10, 08:10, 12:10, 16:10, 20:10 UTC), so **no code change is needed**. Minimum operational steps, all unchanged from `static-refresh-activation.md` and not performed here:

1. Create the `v2-preview` GitHub environment and the `V2_NETLIFY_BUILD_HOOK` secret for the isolated `navvyasignal-v2-preview` site (never a Framer/V1 or Rate Manifest hook).
2. Confirm the Netlify build has outbound network access and does **not** set `V2_CI_STATIC_FIXTURE` or `V2_RSS_FIXTURES=1` (it should not; those are CI-only).
3. Dispatch the workflow manually once, then check the deploy log for `[rss] … unavailable` warnings.
4. GitHub only runs schedules from the default branch, so the schedule starts only after a separately approved merge. Until then, publish by pushing or by manually dispatching the workflow.

Article latency is therefore up to four hours plus build time. Feeds change slowly (the current counts are 60, 1, 1, 17, 9 and 1 items), so a tighter cadence is not needed.

## Known limitations

- Excerpts are truncated summaries only; full article text is never reproduced.
- Each source contributes at most 2 cards (Navyaa 3). Adjust `NETWORK_PER_SOURCE` / `NAVYAA_COUNT` in `FeedSections.tsx`.
- Broken remote images fall back to the text tile underneath the image; no image proxying or validation of image bytes is performed.
- `npm audit` reports advisories in Next.js's bundled PostCSS that predate this change; they were not addressed here.
