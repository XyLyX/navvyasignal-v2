import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { FEED_SOURCES } from '../src/lib/rss/sources.ts';
import { buildNetworkPanels } from '../src/lib/networkPanels.ts';
import { loadAllFeeds } from '../src/lib/rss/service.ts';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('src/app/globals.css');
const page = read('src/app/page.tsx');

test('hero: eyebrow loses PREVIEW only; headline, copy and seven-desk line are kept', () => {
  assert.match(page, /<p className="eyebrow">GLOBAL INTELLIGENCE<\/p>/);
  assert.doesNotMatch(page, /GLOBAL INTELLIGENCE[^<]*PREVIEW/);
  assert.match(page, /Understand what matters\.<br\/><em>See what connects\.<\/em>/);
  assert.match(page, /Independent global intelligence, grounded in documented developments/);
  assert.match(page, /Seven desks/);
  assert.match(page, /Seven intelligence desks/, 'desk section untouched');
  assert.match(page, /Today.s Intelligence/);
  assert.match(page, /Watchlist/);
});

test('hero is compact: reduced padding and a headline scaled for mobile', () => {
  assert.match(css, /\.lead\{background:var\(--deep\);color:white;padding:38px 0 42px\}/, 'desktop hero padding');
  assert.match(css, /\.lead\{padding:26px 0 30px\}/, 'mobile hero padding');
  assert.doesNotMatch(css, /padding:90px 0 100px/);
  assert.match(css, /\.lead h1\{font-size:clamp\(26px,7vw,54px\)/);
  assert.doesNotMatch(css, /\.lead\{padding:65px 0\}/);
});

test('Navyaa: text link removed; genuine logo tile above the third essay; three RSS essays kept', () => {
  const src = read('src/components/FeedSections.tsx');
  assert.doesNotMatch(src, /Visit Navyaa\.blog/);
  assert.match(src, /className="nl-tile" href=\{r\.source\.siteUrl\}/);
  assert.match(src, /Explore ↗/);
  assert.match(src, /NAVYAA_COUNT/);
  assert.match(css, /\.nl-tile\{grid-column:3;grid-row:1/, 'sits in the third column, above the third essay');
  assert.match(css, /\.nl-cards\{grid-column:1 \/ -1\}/);
  assert.match(css, /\.navyaa-lens>div\.nl-cards\{max-width:none\}/, 'legacy 720px cap must not narrow the cards');
  assert.match(css, /\.nl-tile-logo\{[^}]*width:164px;height:164px/, 'square tile');
  assert.match(css, /@media\(max-width:900px\)\{\.navyaa-lens\.nl\{grid-template-columns:1fr\}/);
  const navyaa = FEED_SOURCES.find(s => s.id === 'navyaa')!;
  assert.equal(navyaa.siteUrl, 'https://navyaa.blog/');
  assert.equal(navyaa.logoUrl, 'https://navyaa.blog/images/logo.png');
});

test('only https logos on an allowlisted host are configured', () => {
  for (const s of FEED_SOURCES.filter(s => s.logoUrl)) {
    const u = new URL(s.logoUrl!);
    assert.equal(u.protocol, 'https:');
    assert.ok(s.allowedHosts.includes(u.hostname), s.id);
    assert.ok(!u.username && !u.password);
  }
  assert.deepEqual(FEED_SOURCES.filter(s => s.logoUrl).map(s => s.id), ['navyaa'], 'no invented logos for other ventures');
});

test('homepage and /network share one panel component; directory and cap preserved', () => {
  assert.match(page, /import NetworkPanels from '@\/components\/NetworkPanels'/);
  assert.match(page, /<NetworkPanels data=\{feeds\} heading="From the Navvya Network" \/>/);
  assert.doesNotMatch(page, /NetworkFeed/);
  assert.doesNotMatch(read('src/components/FeedSections.tsx'), /export function NetworkFeed/);
  const net = read('src/app/network/page.tsx');
  assert.match(net, /<NetworkPanels data=\{feeds\} \/>/);
  assert.match(net, /getNetworkCards/, 'network directory kept');
  assert.match(net, /className="network-grid"/);
  assert.match(page, /className="network-home"/, 'homepage venture cards kept');
  assert.match(read('src/lib/rss/limits.ts'), /NETWORK_PER_SOURCE = 2/);
  assert.match(read('src/lib/rss/limits.ts'), /NAVYAA_COUNT = 3/);
});

test('homepage section order keeps editorial separation', () => {
  const i = (s: string) => page.indexOf(s);
  assert.ok(i('Today') > 0 && i('<NavyaaLens') > i('editorial-grid') && i('<NetworkPanels') > i('<NavyaaLens'));
  assert.ok(i('className="network-home"') > i('<NetworkPanels'));
});

test('homepage panels are the same six in the same order with Browse fillers and a join preview link', async () => {
  const dir = path.join(root, 'tests/fixtures/feeds');
  const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(dir, `${s.id}.xml`), 'utf8')]));
  const panels = buildNetworkPanels(await loadAllFeeds({ fixtures, now: new Date('2026-09-24T12:00:00Z') }));
  assert.deepEqual(panels.map(p => p.title), ['OM4BIZ Insights', 'D6 Kitchens Insights', 'Zen Homes Insights', 'Zen Homes Portfolio', 'Design Code Studios Insights', 'Join Our Network']);
  const one = panels.filter(p => p.kind === 'feed' && p.items.length === 1);
  assert.ok(one.length >= 3, 'one-article sources exist in the fixtures');
  assert.match(read('src/components/NetworkPanels.tsx'), /Browse Articles ↗/);
  assert.equal(panels[5].kind === 'join' && panels[5].href, '/network/join');
});

test('branded covers exist for every network source and never use photos or generic images', () => {
  const src = read('src/components/NetworkPanels.tsx');
  for (const s of FEED_SOURCES.filter(s => s.group === 'network')) {
    assert.match(css, new RegExp(String.raw`\.np-cover-${s.id}\{background:`), s.id);
    assert.match(src, new RegExp(`['"]?${s.id}['"]?: '`), `${s.id} monogram`);
  }
  const covers = css.split('\n').filter(l => l.startsWith('.np-cover-')).join('\n');
  assert.doesNotMatch(covers, /url\(/, 'covers are CSS-only, no stock or generic images');
});

test('panel intro kicker and tokens are available on the homepage too', () => {
  assert.match(css, /\.network-page,\.np-section\{--np-ink:/);
  assert.match(css, /\.np-intro \.kicker\{color:var\(--np-gold\)\}/);
});

test('real article photos always stack above the branded cover text; hero and lens kickers stay legible', () => {
  assert.match(css, /\.np-thumb img\{z-index:2\}/);
  assert.match(css, /\.np-thumb-fallback span,\.np-thumb-fallback small\{position:relative;z-index:1\}/);
  assert.match(css, /\.lead \.eyebrow\{color:#dfc48d\}/);
  assert.match(css, /\.nl-head \.kicker\{color:#7d5a14\}/);
});

test('mobile hero copy is scaled down proportionately', () => {
  assert.match(css, /@media\(max-width:640px\)\{\.lead \.intro\{font-size:16px/);
});
