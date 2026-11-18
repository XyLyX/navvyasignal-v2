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
