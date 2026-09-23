# NavvyaSignal V2 — controlled migration

## Production isolation
- Framer V1 stays live and untouched; existing GitHub automation and Notion→Framer sync remain active.
- This scaffold is an isolated Next.js preview. No Notion writes, CMS sync flags, email sends, DNS changes or redirects.
- The Netlify preview site has `robots: noindex, nofollow` in metadata until explicit launch approval.

## Known schema
Notion Signal Feed currently exposes Name, Signal Brief, Text 1, Category, Content Type, Coverage Theme, Internal Note, Long Read, Next Review, Ready to Post, Related Desks, Resolution Signal, Synced to Framer, Today's Intelligence, Watch Status, Watch Trigger and Watchlist. Never publish Internal Note.

## Next development milestones
1. Create a dedicated private GitHub repository and commit this scaffold. Connect it to the isolated Netlify preview site.
2. Configure read-only Notion credentials only on V2; validate 729 vs historical Framer 784 later. Keep Notion ID as immutable identity; preserve existing Framer slugs and canonical URLs.
3. Implement paginated complete archive import and page-block rendering, separate from the current capped preview fetch.
4. Implement explicit Ready to Post gates and editorially approved selections. Never infer lead from chronological ordering.
5. Implement full Watchlist history and resolution relation, Cross-Desk, Weekly Briefing, manually curated Navyaa card and brand-safe ad placeholders.
6. QA accessibility, SEO, mobile, analytics, archive and delta sync; obtain explicit approval before DNS cutover.

## Limitations of this initial scaffold
The read adapter fetches at most 100 items, so homepage and desk listings are incomplete until pagination and editorial queries are implemented. It does not render full article pages, use legacy slugs, support publishing, or send email. Do not use it as production.
