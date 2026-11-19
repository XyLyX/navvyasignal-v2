# Strategic Outlook SEO, GEO, metadata and syndication contract

Status: engineering staging, **all manuscripts on HOLD**. This contract does not authorise publication.

## Isolation
- Canonical base: https://navvyasignal.com/strategic-outlook (only after approval and production deployment).
- Independent from /insights and /signals. Do not mix feed records or snapshots.
- The existing site RSS, sitemap, Notion 30-minute checker, publication lease and build hooks remain untouched.
- All preview pages must be inaccessible by default; where accessible, they have noindex/nofollow/noarchive/nosnippet.
- Do not emit Article/NewsArticle/Report JSON-LD, sitemap entries, canonical production URLs, or public RSS/Atom/JSON Feed entries for unpublished content.
- Reserved feed endpoints /strategic-outlook/rss.xml, /strategic-outlook/atom.xml and /strategic-outlook/feed.json return 404 while HOLD.
- A future publisher must use a single verified, approved, revision-locked snapshot for all HTML, structured data, sitemap, feeds and search indexing.

## Approved-content metadata contract (not enabled)
- Landing page: title, unique description, canonical, Open Graph website, Twitter summary_large_image, language en, accessible hero alt, published/modified dates when applicable.
- Section pages: unique title (<=65 characters when practical), accurate 140–160 character description, canonical, Open Graph article, author/publisher, article:published_time, article:modified_time, cover alt, social share image.
- JSON-LD after publication: CollectionPage and ItemList for series; Article or Report for individual sections, BreadcrumbList, Organization publisher, Person author only when attributed. Stable @id, mainEntityOfPage, inLanguage, datePublished/dateModified, isPartOf and hasPart; no invented ratings, facts or author identity.
- GEO: transparent editorial methodology, named primary sources with dates, direct source links, evidence-versus-forecast distinction, accessible summaries, clear author/byline, updated timestamp, factual claims traceable to source material, stable forecast IDs and immutable baseline.
- Annual review records (2028–2030) must link to original 2027 forecast IDs and record reviewedAt, outcome status, evidence URLs, revisions and material changes. Never rewrite the baseline.
- RSS 2.0, Atom 1.0 and JSON Feed 1.1 must syndicate the exact same **approved** snapshot; GUID/id stable, pubDate/updated from real approval/publication timestamps, description and full-text policy consistent; exclude unpublished and superseded records.
- Publication checks must reject unknown editorial scope, invalid category, unverified evidence, changed approval fingerprint, missing rights or missing publication permission.
- The supplied Economist cover and any generated remake are **not cleared** for public syndication or social preview. Use an original NavvyaSignal-owned hero asset after editorial and rights approval.

## Acceptance tests before release
1. Unapproved pages absent from public HTML/JSON-LD/RSS/Atom/JSON Feed/sitemap and indexing.
2. Approved+Ready but unverified entries also absent.
3. Post-approval edits invalidate publication until reapproval.
4. Unknown category/scope fails closed.
5. No cross-stream contamination with Insights or Signal Feed.
6. No duplicate canonical or inconsistent published/modified timestamps.
7. Run CI and protected Netlify preview acceptance; verify no public assets leak.
