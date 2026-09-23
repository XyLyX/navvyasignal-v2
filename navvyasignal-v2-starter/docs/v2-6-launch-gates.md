# V2.6–Launch readiness: controlled rollout checklist

Status: V2.6 homepage and related historical article navigation committed on `notion-readonly`. Preview only; production Framer V1, DNS, Kit, Whapi and existing production automations are untouched.

## Editorial homepage
- Today's Intelligence accepts only approved records with Today's Intelligence checked and an exact Dubai-local Homepage Date; empty state remains intentional until genuinely new editorial selections arrive.
- Watchlist displays approved Active records; other statuses stay on the Watchlist page.
- Cross-Desk Intelligence, Friday Weekly Briefing and Long Reads now have clearly labelled empty editorial layouts. Do not fabricate sample editions or backfill historical stories as current.
- A Different Lens links to https://navyaa.blog/ as a **separate** publication. Feature a specific essay only after Navin manually approves its title, URL, excerpt and placement. Do not automatically syndicate or import Navyaa articles.
- The CPC/sponsor reserve is **inactive**. Before activation: approve ad partners, inventory and placements; visibly label paid content; keep ads visually separate from editorial judgment; confirm any outbound affiliate or owned-business links are appropriately disclosed. Candidate contextual owned links: property → Zen Homes Global, build/fit-out → Design Code Studios, travel → Rate Manifest. No live ads, tracking pixels, ad scripts or payment integrations added in V2.6.

## Article discovery
- Archive keyword/desk/month filters and 20-item pagination are client-side and preserve direct article links.
- Month means Notion record **creation** month, not verified original publication month.
- Article pages offer same-category historical links and seven-desk navigation when a category matches. This is not semantic recommendation or evidence of a shared topic.
- Browser acceptance: test archive search with empty and nonempty results, old/new Maritime labels, mobile controls, pagination after filter changes, article-to-desk navigation and accessible focus.

## Publishing and quality
- The CommonJS test `exports` redeclaration was corrected; a missing-priority deterministic sort test was added and the `Infinity - Infinity` comparator bug fixed.
- Run `node --test tests/homepage-selection.test.cjs`, `npm run typecheck`, `npm run build` in nested app and inspect GitHub Actions. CI pass **not yet verified** for latest commit.
- Run `npm audit --omit=dev` and `npm audit`; investigate known PostCSS advisories and lockfile resolution. Do not run `npm audit fix --force` or introduce a breaking Next upgrade without reviewing compatibility.
- Verify a **synthetic** fixture tests newly approved story inclusion without writing to Notion; do not backfill historical content or modify live editorial records.

## Launch gates — NOT YET COMPLETE
1. Reconcile original Framer legacy URLs and verified original publication dates before setting canonical URLs or redirects. Notion created_time is not an original publication date.
2. Review page-specific SEO, structured data, sitemap, redirects, social cards and accessibility; preview remains robots noindex.
3. Confirm V2-only Netlify branch build hook and GitHub environment secret before enabling scheduled refresh; GitHub schedules run only on default branch. Confirm Dubai midnight rollover behavior for static export.
4. Validate desktop/mobile layouts and TradingView widget loads in an actual browser; quotes may be delayed.
5. Update draft PR description, review CI/security results and explicitly obtain merge approval.
6. Production deployment, domain/DNS cutover, Kit and Whapi changes require separate explicit authorization. Never infer it from preview approval.
