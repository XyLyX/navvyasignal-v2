#!/usr/bin/env node
// Scans a static-export directory (default navvyasignal-v2-starter/out) for Insights exposure.
//   --absent  : fails if the Part 1 slug/title/BLUF/notes appear anywhere, or if any feed/sitemap lists an article
//   --present : fails unless the article appears in its page, RSS, sitemap and JSON-LD (positive control)
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const part1 = require('../navvyasignal-v2-starter/tests/fixtures/insights/part1.cjs');

const OUT = path.resolve(process.argv.find((a) => a.startsWith('--out='))?.slice(6) || path.join(__dirname, '..', 'navvyasignal-v2-starter', 'out'));
const SLUG = 'the-world-ahead-2027-converging-risks';
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(OUT);
const textFiles = files.filter((f) => /\.(html|txt|xml|json|js|css|map)$/.test(f));
const needles = [SLUG, part1.page.properties.Title.title[0].plain_text, part1.BLUF.slice(0, 60), part1.NOTES.slice(0, 40), 'Editorial Notes', 'Approval Fingerprint'];
const hits = [];
for (const f of textFiles) {
  const t = fs.readFileSync(f, 'utf8');
  for (const n of needles) if (t.includes(n) || t.includes(JSON.stringify(n).slice(1, -1))) hits.push(`${path.relative(OUT, f)} contains "${n.slice(0, 30)}"`);
}
const read = (rel) => (fs.existsSync(path.join(OUT, rel)) ? fs.readFileSync(path.join(OUT, rel), 'utf8') : '');
const feeds = ['insights/rss.xml', 'insights/analysis/rss.xml', 'insights/explainers/rss.xml', 'insights/world-ahead/rss.xml', 'insights/special-reports/rss.xml', 'insights/sitemap.xml'];
const result = { out: path.relative(process.cwd(), OUT), filesScanned: textFiles.length };

if (process.argv.includes('--present')) {
  const page = read(`insights/${SLUG}.html`);
  const checks = {
    page: page.includes(part1.page.properties.Title.title[0].plain_text.replace(/'/g, '&#x27;')) || page.includes('converging pressures'),
    jsonLd: /application\/ld\+json/.test(page) && page.includes('"@type":"Article"'),
    rss: read('insights/rss.xml').includes(`/insights/${SLUG}`),
    categoryRss: read('insights/analysis/rss.xml').includes(`/insights/${SLUG}`),
    sitemap: read('insights/sitemap.xml').includes(`/insights/${SLUG}`),
    noPrivateNotes: !hits.some((h) => /Editorial Notes|PRIVATE|Approval Fingerprint/.test(h))
  };
  result.checks = checks;
  const ok = Object.values(checks).every(Boolean);
  console.log(JSON.stringify(result));
  process.exit(ok ? 0 : 1);
}
// --absent (default)
const emptyFeeds = feeds.filter((f) => /<item>|<url><loc>[^<]*\/insights\/[^<]+<\/loc>/.test(read(f).replace('<loc>https://navvyasignal.com/insights</loc>', '')));
const placeholder = read('insights/__no-published-insights__.html');
const pageSignals = {
  insightsPagesWithArticleJsonLd: files.filter((f) => /insights.*\.html$/.test(f) && /"@type":"Article"/.test(fs.readFileSync(f, 'utf8'))).map((f) => path.relative(OUT, f)),
  placeholderNoindex: !placeholder || /name="robots" content="noindex/.test(placeholder)
};
Object.assign(result, { exposureHits: hits, feedsListingArticles: emptyFeeds, ...pageSignals });
console.log(JSON.stringify(result));
process.exit(hits.length || emptyFeeds.length || pageSignals.insightsPagesWithArticleJsonLd.length || !pageSignals.placeholderNoindex ? 1 : 0);
