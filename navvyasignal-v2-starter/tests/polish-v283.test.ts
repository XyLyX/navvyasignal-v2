import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { desks } from '../src/lib/desks.ts';
import { networkVentures } from '../src/lib/network.ts';
import { FEED_SOURCES } from '../src/lib/rss/sources.ts';
import { buildNetworkPanels } from '../src/lib/networkPanels.ts';
import { loadAllFeeds } from '../src/lib/rss/service.ts';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('src/app/globals.css');
const page = read('src/app/page.tsx');
const panelsSrc = read('src/components/NetworkPanels.tsx');

// ---- 1. seven desks ----

test('seven desks: same seven names, order, links and card content; no eighth desk', () => {
  assert.deepEqual(desks.map(d => d.name), ['West Asia', 'India', 'UAE', 'Global Politics', 'Markets & Capital', 'Technology & AI', 'Maritime, Energy & Supply Chains']);
  assert.deepEqual(desks.map(d => d.slug), ['west-asia', 'india', 'uae', 'global-politics', 'markets-capital', 'technology-ai', 'maritime-energy-supply-chains']);
  assert.ok(page.includes("className={`desk desk--${d.slug}`}"), "seven desk links have image-ready slug classes");
  assert.match(page, /<span>0\{i \+ 1\}<\/span><h3>\{d\.name\}<\/h3><b>Explore desk ↗<\/b>/);
  assert.match(page, /Seven intelligence desks/);
});

test('seven desks: 4 + 3 evenly distributed on desktop, last card spans the row on tablet', () => {
  assert.match(css, /@media\(min-width:761px\)\{\.desk-grid\{grid-template-columns:repeat\(12,minmax\(0,1fr\)\)\}\.desk\{grid-column:span 3\}\.desk:nth-child\(n\+5\)\{grid-column:span 4\}\}/);
  assert.match(css, /@media\(min-width:441px\) and \(max-width:760px\)\{\.desk:last-child\{grid-column:1 \/ -1\}\}/);
  // 4 x span 3 and 3 x span 4 both fill twelve columns exactly
  assert.equal(4 * 3, 12);
  assert.equal(3 * 4, 12);
  assert.equal(desks.length, 4 + 3);
});

// ---- 2. network panels ----

test('panels: compact Browse Articles footer replaces dashed placeholders', () => {
  assert.doesNotMatch(css, /np-item-empty/);
  const npRules = css.split('\n').filter(l => /^\.np-/.test(l)).join('\n');
  assert.doesNotMatch(npRules, /dashed/, 'no dashed placeholder boxes remain in the panels');
  assert.match(css, /\.np-foot\{margin-top:auto;padding-top:12px;border-top:1px solid var\(--np-line\)\}/);
  assert.match(css, /\.np-slots\{flex:1;display:flex;flex-direction:column;gap:12px\}/);
  assert.match(panelsSrc, /<footer className="np-foot">/);
  assert.match(panelsSrc, /Browse Articles ↗/);
  assert.doesNotMatch(panelsSrc, /That is everything listed/);
  assert.match(css, /\.np-grid\{[^}]*grid-auto-rows:1fr/, 'six equal outer panels');
});

test('panels: both articles kept where present, newest first, publisher order on ties', async () => {
  const dir = path.join(root, 'tests/fixtures/feeds');
  const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(dir, `${s.id}.xml`), 'utf8')]));
  const panels = buildNetworkPanels(await loadAllFeeds({ fixtures, now: new Date('2026-09-24T12:00:00Z') }));
  const byId = Object.fromEntries(panels.map(p => [p.id, p]));
  for (const id of ['zen-insights', 'zen-portfolio']) assert.equal((byId[id] as any).items.length, 2, id);
  for (const id of ['om4biz', 'd6-kitchens', 'design-code']) assert.equal((byId[id] as any).items.length, 1, id);
  assert.deepEqual((byId['zen-portfolio'] as any).items.map((i: any) => i.title), ['Fixture: Marina Waterfront & Residences', 'Fixture: Metro-side tower']);
  for (const p of panels) if (p.kind === 'feed') {
    const d = p.items.map(i => i.publishedAt);
    assert.deepEqual(d, [...d].sort().reverse(), p.id);
  }
});

// ---- 3. Join panel ----

test('join panel: centred invitation, prominent gold Start an Enquiry button, links to /network/join', () => {
  assert.match(css, /\.np-join-body\{[^}]*justify-content:center;align-items:center;text-align:center/);
  assert.match(css, /\.np-join-cta\{align-self:center;[^}]*background:var\(--gold\)/);
  assert.match(css, /\.np-join-cta\{[^}]*padding:15px 34px[^}]*font:700 16px/);
  assert.match(panelsSrc, /<Link className="np-join-cta" href=\{p\.href\}>Start an Enquiry →<\/Link>/);
  assert.equal(buildNetworkPanels([]).at(-1)?.kind === 'join' && (buildNetworkPanels([]).at(-1) as any).href, '/network/join');
});

// ---- 4. Navyaa ----

test('Navyaa: three essays, verified monogram and Explore link; larger tile stays aligned above the third essay', () => {
  const lens = read('src/components/FeedSections.tsx');
  assert.match(lens, /NAVYAA_COUNT/);
  assert.equal(FEED_SOURCES.find(s => s.id === 'navyaa')!.logoUrl, 'https://navyaa.blog/images/logo.png');
  assert.match(lens, /Explore ↗/);
  assert.match(css, /\.nl-tile\{grid-column:3;grid-row:1;justify-self:start[^}]*width:164px/);
  assert.match(css, /\.nl-tile-logo\{[^}]*width:164px;height:164px/);
  assert.match(css, /\.nl-tile\{grid-column:1;grid-row:auto;width:120px\}\.nl-tile-logo\{width:120px;height:120px\}/);
  assert.match(read('src/lib/rss/limits.ts'), /NAVYAA_COUNT = 3/);
});

// ---- 5. images ----

test('images: covers stay CSS-only, photos stack above them, no stock or generic image references', () => {
  const covers = css.split('\n').filter(l => l.startsWith('.np-cover-')).join('\n');
  assert.doesNotMatch(covers, /url\(/);
  assert.match(css, /\.np-thumb img\{z-index:2\}/);
  assert.doesNotMatch(panelsSrc, /unsplash|pexels|stock|og-image|placeholder/i);
});

// ---- 6. directory ----

test('directory keeps Rate Manifest and FilsOnly as venture entries, never as RSS contributors', () => {
  const slugs = networkVentures.map(v => v.slug);
  assert.ok(slugs.includes('rate-manifest') && slugs.includes('fils-only'));
  assert.equal(networkVentures.length, 8);
  for (const slug of ['rate-manifest', 'fils-only']) {
    assert.equal(networkVentures.find(v => v.slug === slug)!.feedStatus, 'unverified', slug);
  }
  const ids = FEED_SOURCES.map(s => s.id);
  assert.ok(!ids.some(id => /rate|fils/i.test(id)));
  assert.ok(!FEED_SOURCES.some(s => /ratemanifest|filsonly/i.test(s.feedUrl + s.siteUrl + s.allowedHosts.join())));
  assert.equal(FEED_SOURCES.length, 6);
  // The homepage deliberately uses the approved three-row order, not the old directory filter.
  const homepageOrder = ['om4biz','fils-only','rate-manifest','zen-homes','design-code','d6-kitchens'];
  for (const slug of homepageOrder) assert.ok(networkVentures.some(v => v.slug === slug), slug);
  assert.match(page, /networkCards\.find\(v => v\.slug === slug\)/, 'homepage renders ordered venture entries');
  assert.match(page, /the-wasam/, 'third row contains The Wasam');
  assert.match(page, /\[1,2\]\.map\(n =>/, 'third row reserves two Coming Soon cards');
  assert.match(read('src/app/network/page.tsx'), /cards\.map\(v=>/);
});
