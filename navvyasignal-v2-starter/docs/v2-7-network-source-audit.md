# V2.7 Navvya Network source audit — 24 September 2026

Read-only Netlify account verified: navvyasignal@outlook.com (team 6a5e44dfd51a684dddc61182). Its six accessible projects include V2 preview, OM4BIZ (splendid-sprinkles-960e3a), OM4BIZ Navin card, D6 Kitchens (d6-kitchens), thewasam.com, and an older NavvyaSignal daily brief. **Do not assume all ventures share this account**; the other sites may belong to different Netlify accounts/teams. No project settings, hooks or production deployments were changed.

Public content evidence: Zen Homes has a portfolio listing at https://zenhomesglobal.com/portfolio and article pages, but a machine-readable feed is not yet verified. Navyaa's conventional /feed.xml and /rss.xml could not be verified from public retrieval; no working feed URL is assumed. D6 Kitchens and OM4BIZ Netlify project identities are confirmed on the connected account, but their article schemas, repository links, feed endpoints and deployment triggers have not been inspected.

## Network directory
Seven source entries: Navyaa, Zen Homes Global, Rate Manifest, OM4BIZ, Design Code Studios, FilsOnly, D6 Kitchens. A static /network directory and homepage links were added to the V2-only development branch. These are **affiliated** listings, not sponsored third-party ads. Navyaa is a separate publication. No live external feed import or new production webhook is active.

## Safe automation design
1. Verify each venture's owning Netlify team, production site ID, public content feed and published-item identifier. Deployment completion alone is not proof that new editorial content was published.
2. For Navyaa, prefer a published-article JSON/RSS feed or an authenticated read-only CMS endpoint. Use canonical URL as deduplication key and preserve original article date, image attribution, excerpt and direct outbound link.
3. For commercial ventures, normalize approved public posts/projects to a distinct affiliate-network feed with visible ownership disclosure. Never send these into Notion Today's Intelligence or seven-desk reporting.
4. Poll feeds on a modest schedule or use a source-specific successful production-deploy webhook **only after** verifying its content feed. Validate canonical domain, HTTP timeout, payload size, published status and duplicate URLs. If a source is unavailable, retain the last verified snapshot rather than inventing an update.
5. For static-export V2, verified new items require a V2-branch-specific Netlify build hook. Before creating or firing one, verify Netlify account navvyasignal@outlook.com, target branch, and existing refresh schedule; protect hook URL as a secret. No production Framer, DNS, Kit, Whapi or other venture deploy settings may be modified in this phase.
6. Separate clearly labelled affiliate placements from third-party CPC ads. No CPC campaigns, click trackers or ad scripts are active.

## Next verification gates
- Identify Netlify teams for Navyaa, Zen Homes, Rate Manifest, Design Code Studios and FilsOnly, without switching or writing to another account implicitly.
- Confirm each source feed, especially Navyaa, before enabling automatic publication.
- Run V2 branch CI and verify V2 preview /network on desktop/mobile.
- Keep PR draft and main untouched until user explicitly approves merge.
