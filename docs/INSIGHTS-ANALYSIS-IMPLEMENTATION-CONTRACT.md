# Insights & Analysis — Implementation Contract

Status: Approved product direction; engineering integration pending repository inspection.
Scope: NavvyaSignal V2, integrated editorial section. This document does not authorize production publication or deployment.

## Public information architecture
- /insights — editorial landing page with featured article, latest articles, topic filters, series and pagination.
- /insights/[slug] — article page, unique canonical URL, title, dek, hero, byline, published/updated dates, reading time, body, source references, related Signals, series navigation.
- Categories: Analysis, Explainers, The World Ahead, Special Reports. Desks remain existing NavvyaSignal desks; categories are article formats, not competing desks.
- Main navigation: Insights & Analysis, linking to /insights. Existing Signal Feed remains unchanged.
- Responsive layouts: readable 65–75ch body measure, accessible contrast, mobile-safe images and cards, no clipped metadata.

## Notion editorial data model (new separate database)
Required fields:
- Title (title), Slug (rich text, unique), Subtitle (rich text), Body (page blocks)
- Category (select: Analysis | Explainers | The World Ahead | Special Reports)
- Desk (multi-select mapped to existing desks)
- Status (select: Draft | In Review | Approved | Published | Archived)
- Ready to Post (checkbox), Publish At (date, optional)
- Hero Image (files or vetted external URL), Hero Alt Text (rich text)
- Author (rich text), Editor (rich text), Sources (page blocks or relation)
- Series (rich text or relation), Series Part (number), Related Signals (relation)
- Published At (date), Updated At (date), SEO Title (rich text), SEO Description (rich text)
- Notion Page ID as immutable external identity; store last published revision/hash separately.
Do not assume these properties already exist; validate before writing. No migration of Signal Feed entries.

## Publication contract
- Article is eligible only when Status=Approved AND Ready to Post=true AND Publish At is absent or in the past.
- Notion polling may reuse the existing 30-minute cadence but must have an independent article handler, failure isolation, idempotent revision comparison and auditable records.
- Use existing production publication lease / authorized build-hook path. Never create a second direct-to-Netlify deployment trigger.
- The publishing worker should write a normalized snapshot; public rendering must not depend on live Notion API availability.
- Validate slug uniqueness, permitted content blocks, image rights/alt text, source references and article metadata before publication.
- Sanitize rich text and URLs; reject arbitrary HTML/scripts. Never expose Notion secrets client-side.
- Published content updates require a new explicit approval of the changed revision. Unchecking Ready to Post alone does not silently retract already published content; use an explicit unpublish/archive action with audit.
- Article writes must not change Signal Feed selection, today's intelligence, homepage priorities or its existing schedule.
- Prevent simultaneous conflicting revisions using existing lease and revision checks.

## SEO, trust and accessibility
- Canonical links, OpenGraph/Twitter metadata, Article JSON-LD, sitemap and RSS discovery.
- Distinguish analysis, reporting, opinion and scenarios visibly; clearly label forecasts as scenarios rather than facts.
- Author and editorial disclosure, cited sources, corrections/update timestamps, no invented citations.
- Semantic headings, keyboard navigation, image alt text, accessible contrast and responsive typography.
- Internal links from articles to relevant Signal Feed posts, not automatic reclassification of signals as analysis.

## Acceptance tests
1. Index and article route render desktop/mobile with no overflow.
2. Draft, In Review and unapproved articles never appear publicly.
3. Approved + Ready to Post + scheduled time gate behaves correctly.
4. Same Notion revision processed twice results in one publication.
5. Edits after publication do not bypass fresh approval.
6. Invalid slug, unsafe HTML, missing hero alt and missing sources fail validation.
7. Existing Signal Feed and its scheduled workflow remain unchanged.
8. Publishing uses the existing lease and build-hook-only deployment path; Git-trigger isolation is verified before production rollout.
9. Correct 404, canonical, sitemap, metadata and series next/previous links.
10. Production acceptance requires an actual approved article, a successful authorized publish and live URL verification; never fabricate a test signal.

## Delivery sequence
1. Inspect repository structure, existing site routes, Notion bridge and production isolation.
2. Implement new Notion schema adapter and article snapshot publishing behind a feature flag.
3. Implement index/article routes and responsive editorial UI.
4. Add SEO, series, related signals and observability.
5. Run automated regression and staging E2E tests.
6. Obtain one approved real article and perform production acceptance.
7. Enable navigation after acceptance; preserve rollback switch.

## Non-goals
- No WordPress, second CMS or independent publishing infrastructure.
- No automatic AI-authored publication without editorial approval.
- No change to existing signal desks, schedules, publication leases or Netlify production settings without separate verification.

## Mandatory discoverability: SEO, GEO, metadata and syndication

### Technical SEO and indexing
- Render article content and metadata in crawlable HTML (SSR or static prerender); do not depend on client-only JavaScript or a live Notion request for article text.
- Maintain a single canonical origin https://navvyasignal.com, canonical /insights/[slug] URLs, correct HTTP 200/301/404/410, and consistent trailing-slash policy.
- Generate /sitemap.xml or a sitemap index containing only publicly approved canonical URLs, accurate lastmod derived from material content changes, and discoverable sitemap links in robots.txt.
- Use noindex on staging, previews, internal search and unpublished articles. Never rely on robots.txt alone to hide confidential drafts; drafts require access controls.
- Provide semantic H1/H2 hierarchy, descriptive internal anchors, breadcrumbs, optimized responsive images, alt text, image dimensions, loading priorities and Core Web Vitals monitoring.
- Link relevant articles to Signal Feed coverage and vice versa where editorially appropriate. Avoid duplicate article routes and thin tag archives.

### Per-article metadata contract
- Required: SEO title, meta description, canonical URL, language, title, subtitle, author, publishedAt, modifiedAt, hero image and alt text, desk, category, article body, primary sources.
- Optional: tags, geographic coverage, series ID/part, editor, correction note, original reporting flag, social image override and summary.
- Generate title and description from reviewed editorial fields if absent, but never silently invent authors, facts, sources or dates. Enforce sensible length guidance without hard truncation of essential meaning.
- Generate Open Graph og:type=article, og:title, og:description, og:url, og:image, og:image:alt, article:published_time, article:modified_time, article:author when a valid URL exists, and article:section; add X/Twitter summary_large_image tags.
- Emit one consistent JSON-LD graph with Organization/Publisher, WebSite, BreadcrumbList and Article or NewsArticle as factually appropriate. Use real author identity (Person/Organization), headline, description, image, datePublished, dateModified, mainEntityOfPage, publisher, inLanguage and articleSection. Do not falsely label opinion or analysis as breaking news.
- All timestamps must be ISO 8601 with timezone; publishedAt stays stable through edits and modifiedAt changes only for substantive approved updates.

### GEO: AI answer-engine discoverability
- Use original, attributable analysis with explicit evidence, primary-source links, author expertise, corrections policy and concise factual executive summaries.
- Provide meaningful section headings, dated context, clearly distinguished facts vs inference vs scenarios, definitional explainers and machine-readable article semantics.
- Make approved article text available to permitted crawlers in server-rendered HTML; assess robots directives and CDN/WAF rules for Googlebot, Bingbot and relevant AI crawlers individually according to editorial licensing policy.
- No guarantee of AI citations, rankings or inclusion. Do not promise that llms.txt or schema markup forces citations. Optional /llms.txt may be evaluated separately, never substituted for crawlability.
- Geographic coverage is editorial topic metadata, not automatic local-business SEO: do not fabricate UAE local-business addresses or geographic claims.

### RSS feeds and feed discovery
- /insights/rss.xml: valid RSS 2.0 with channel title, link, description, language, lastBuildDate and atom:link rel=self.
- /insights/analysis/rss.xml, /insights/explainers/rss.xml, /insights/world-ahead/rss.xml and /insights/special-reports/rss.xml: category feeds, generated only from published approved content.
- Desk-specific feeds may be added at /insights/desks/[desk-slug]/rss.xml after validating existing desk slugs and taxonomy.
- Each item includes stable GUID (canonical URL or immutable published ID), title, canonical link, description/summary, pubDate RFC 822, author when verified, category and source attribution; content:encoded is optional and must be sanitized and licensing-safe.
- Order newest first; cap feed length with documented retention; preserve GUID and original pubDate on edits. Update channel lastBuildDate only for actual feed content changes.
- Add HTML <link rel="alternate" type="application/rss+xml"> feed discovery on index, article and category pages. Return application/rss+xml; charset=utf-8 and validate XML escaping.
- Feed generation must read the same approved published snapshot as site rendering and sitemap generation. A Notion draft or scheduled item must never leak into RSS.
- Do not create separate uncontrolled deployment triggers to refresh feeds.

### SEO/GEO/RSS acceptance gates
- Assert exact title, description, canonical, OG/X tags and valid JSON-LD for index and article routes.
- Assert robots and sitemap contain only eligible canonical URLs; staged/draft content is absent from public HTML, sitemap and RSS.
- Validate RSS 2.0 with XML parser, feed autodiscovery, stable GUIDs, timezone-correct pubDate, categories, UTF-8 and XML escaping.
- Test article revision, deletion/unpublish, schedule boundary, malformed source metadata, image failures and 404/410 behavior across page, sitemap and feeds.
- Verify Google Search Console and Bing Webmaster Tools ownership only with authorized account access; submit sitemaps after release, then monitor indexing, crawl errors, search impressions and AI referral traffic where observable.
- Run mobile performance/accessibility tests and verify that no additional Git-triggered Netlify production path is introduced.

## Notion bridge (implemented in `insights/`, not wired to any workflow or deployment)
- `notion-bridge.cjs`: reads only the dedicated Insights data source (refuses the Signal Feed id), normalises pages, applies fail-closed category/scope mappings and every publication gate, and builds the public snapshot from an explicit field allowlist.
- Gates (all required): Status Approved (or Published), Ready to Post checked, Verification Status Verified, Publish At/Published At present and not in the future, valid slug/author/BLUF/body, every source with an https URL, and an **Approval Fingerprint** equal to the current content fingerprint.
- Content fingerprint = SHA-256 over Title, BLUF, body paragraphs and Sources (NFC-normalised). Metadata edits, status changes and the approval action itself do not change it; any change to those four fields invalidates approval.
- Writes are limited to two explicit actions: `--reconcile` returns a materially revised article to In Review (Status, Ready to Post, Approval Fingerprint only) and `--approve <pageId>` records the fingerprint of an article that otherwise passes every gate. Default is a read-only dry run.
- **Required Notion property (not yet created):** `Approval Fingerprint` (rich text) on the Insights database. Until it exists every record fails closed (`missing_property:Approval Fingerprint`).
- `Editorial Notes` is never read into public output; `assertNoPrivateLeak` fails the build if its text appears in any public field.
- `insights/verify-build-output.cjs` scans a static export for exposure (`--absent`) or confirms a positive control (`--present`).
