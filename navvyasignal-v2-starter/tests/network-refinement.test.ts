import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFeed } from '../src/lib/rss/parse.ts';
import { getSource, FEED_SOURCES } from '../src/lib/rss/sources.ts';
import { loadSource, loadAllFeeds, sortAndDedupe, type SourceResult } from '../src/lib/rss/service.ts';
import { enrichOgImages, extractOgImage, isGenericImageUrl } from '../src/lib/rss/ogImage.ts';
import { buildNetworkPanels } from '../src/lib/networkPanels.ts';
import { validateJoin } from '../src/lib/joinForm.ts';
import { NETWORK_PER_SOURCE } from '../src/lib/rss/limits.ts';

const root = path.join(import.meta.dirname, '..');
const NOW = new Date('2026-09-24T12:00:00Z');
const rss = (items: string) => `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel><title>t</title>${items}</channel></rss>`;
const item = (slug: string, date: string, host = 'zenhomesglobal.com', extra = '') => `<item><title>${slug}</title><link>https://${host}/${slug}/</link><pubDate>${date}</pubDate>${extra}</item>`;

// ---- Zen Homes ordering: newest genuine date first, publisher order for exact ties ----

test('portfolio: newest first by real instant, ties keep the publisher order, input order is irrelevant', () => {
  const zp = getSource('zen-portfolio')!;
  // The feed lists an older item first, and two items share a timestamp (as on the live Portfolio page).
  const xml = rss(
    item('older-19-sep', 'Sat, 19 Sep 2026 09:00:00 +0400') +
    item('tie-first', 'Tue, 22 Sep 2026 09:00:00 +0400') +
    item('tie-second', 'Tue, 22 Sep 2026 09:00:00 +0400') +
    item('later-instant-other-zone', 'Tue, 22 Sep 2026 03:00:00 -0500')); // 08:00Z is after 05:00Z
  const items = parseFeed(xml, zp, NOW).items;
  const order = sortAndDedupe(items).map(i => i.title);
  assert.deepEqual(order, ['later-instant-other-zone', 'tie-first', 'tie-second', 'older-19-sep']);
  assert.deepEqual(sortAndDedupe([...items].reverse()).map(i => i.title), order);
});

test('feed items record their position in the source feed', () => {
  const zp = getSource('zen-portfolio')!;
  const items = parseFeed(rss(item('a', 'Tue, 22 Sep 2026 09:00:00 +0400') + item('b', 'Tue, 22 Sep 2026 09:00:00 +0400')), zp, NOW).items;
  assert.deepEqual(items.map(i => i.feedIndex), [0, 1]);
});

test('every fixture with tied timestamps preserves feed order', async () => {
  const dir = path.join(root, 'tests/fixtures/feeds');
  const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(dir, `${s.id}.xml`), 'utf8')]));
  const r = await loadAllFeeds({ fixtures, now: NOW });
  const titles = (id: string) => r.find(x => x.source.id === id)!.items.map(i => i.title);
  assert.deepEqual(titles('zen-portfolio'), ['Fixture: Marina Waterfront & Residences', 'Fixture: Metro-side tower']);
  assert.deepEqual(titles('zen-insights'), ['Fixture: Waterfront island yields', 'Fixture: Downtown or Marina']);
});

// ---- article-level images: feed first, then a validated article OG image, else nothing ----

type Route = { status?: number; type?: string; body?: string; length?: string; location?: string };
function fakeFetch(routes: Record<string, Route>) {
  const calls: string[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    const r = routes[url];
    if (!r) return new Response('nf', { status: 404 });
    const headers: Record<string, string> = { 'content-type': r.type ?? 'text/html; charset=utf-8' };
    if (r.length) headers['content-length'] = r.length;
    if (r.location) headers.location = r.location;
    return new Response(init?.method === 'HEAD' ? null : (r.body ?? ''), { status: r.status ?? 200, headers });
  }) as unknown as typeof fetch;
  return { f, calls };
}
const og = (u: string) => `<html><head><meta property="og:image" content="${u}"></head></html>`;
const H = 'https://om4biz.com';
const img = { type: 'image/jpeg' };
async function result(items: string, id = 'om4biz'): Promise<SourceResult> {
  const r = await loadSource(getSource(id)!, { fixtures: { [id]: rss(items) }, now: NOW });
  assert.equal(r.status, 'ok');
  return r;
}
const two = () => item('one', 'Tue, 22 Sep 2026 09:00:00 +0400', 'om4biz.com') + item('two', 'Mon, 21 Sep 2026 09:00:00 +0400', 'om4biz.com');

test('feed image wins: no article or image request is made', async () => {
  const r = await result(item('one', 'Tue, 22 Sep 2026 09:00:00 +0400', 'om4biz.com', '<enclosure url="https://om4biz.com/i/feed.jpg" type="image/jpeg" length="1"/>'));
  const { f, calls } = fakeFetch({});
  const [out] = await enrichOgImages([r], { fetchImpl: f, perSource: 2 });
  assert.equal(out.items[0].imageUrl, 'https://om4biz.com/i/feed.jpg');
  assert.equal(out.items[0].imageSource, 'feed');
  assert.deepEqual(calls, []);
});

test('an authentic article OG image is used and marked as og', async () => {
  const r = await result(item('one', 'Tue, 22 Sep 2026 09:00:00 +0400', 'om4biz.com'));
  const { f } = fakeFetch({ [`${H}/`]: { body: og(`${H}/og-image.png`) }, [`${H}/one/`]: { body: og(`${H}/uploads/one-cover.jpg`) }, [`${H}/uploads/one-cover.jpg`]: img });
  const [out] = await enrichOgImages([r], { fetchImpl: f, perSource: 2 });
  assert.equal(out.items[0].imageUrl, `${H}/uploads/one-cover.jpg`);
  assert.equal(out.items[0].imageSource, 'og');
});

test('site-wide default, shared, logo-like, foreign, insecure and non-image OG candidates are all rejected', async () => {
  const cases: [string, Record<string, Route>][] = [
    ['equals homepage OG image', { [`${H}/`]: { body: og(`${H}/uploads/site.jpg`) }, [`${H}/one/`]: { body: og(`${H}/uploads/site.jpg`) }, [`${H}/uploads/site.jpg`]: img }],
    ['generic filename', { [`${H}/one/`]: { body: og(`${H}/assets/og/og-default.jpg`) }, [`${H}/assets/og/og-default.jpg`]: img }],
    ['logo', { [`${H}/one/`]: { body: og(`${H}/logo.png`) }, [`${H}/logo.png`]: img }],
    ['foreign host', { [`${H}/one/`]: { body: og('https://evil.example/cover.jpg') }, 'https://evil.example/cover.jpg': img }],
    ['http scheme', { [`${H}/one/`]: { body: og('http://om4biz.com/cover.jpg') }, 'http://om4biz.com/cover.jpg': img }],
    ['not an image', { [`${H}/one/`]: { body: og(`${H}/uploads/cover.jpg`) }, [`${H}/uploads/cover.jpg`]: { type: 'text/html' } }],
    ['oversized image', { [`${H}/one/`]: { body: og(`${H}/uploads/cover.jpg`) }, [`${H}/uploads/cover.jpg`]: { ...img, length: '50000000' } }],
    ['image is missing', { [`${H}/one/`]: { body: og(`${H}/uploads/cover.jpg`) } }],
    ['article redirects off-site', { [`${H}/one/`]: { status: 302, location: 'https://evil.example/one/' } }],
    ['article is not html', { [`${H}/one/`]: { type: 'application/pdf', body: og(`${H}/uploads/cover.jpg`) }, [`${H}/uploads/cover.jpg`]: img }],
    ['article request fails', { [`${H}/one/`]: { status: 500 } }],
  ];
  for (const [name, routes] of cases) {
    const r = await result(item('one', 'Tue, 22 Sep 2026 09:00:00 +0400', 'om4biz.com'));
    const [out] = await enrichOgImages([r], { fetchImpl: fakeFetch(routes).f, perSource: 2 });
    assert.equal(out.items[0].imageUrl, null, name);
    assert.equal(out.items[0].imageSource, null, name);
  }
});

test('two articles sharing one OG image reveals a generic image and both are rejected', async () => {
  const r = await result(two());
  const { f } = fakeFetch({ [`${H}/one/`]: { body: og(`${H}/uploads/shared.jpg`) }, [`${H}/two/`]: { body: og(`${H}/uploads/shared.jpg`) }, [`${H}/uploads/shared.jpg`]: img });
  const [out] = await enrichOgImages([r], { fetchImpl: f, perSource: 2 });
  assert.deepEqual(out.items.map(i => i.imageUrl), [null, null]);
});

test('OG lookup is limited to displayed items, network sources with status ok, and never throws', async () => {
  const three = item('one', 'Tue, 22 Sep 2026 09:00:00 +0400', 'om4biz.com') + item('two', 'Mon, 21 Sep 2026 09:00:00 +0400', 'om4biz.com') + item('three', 'Sun, 20 Sep 2026 09:00:00 +0400', 'om4biz.com');
  const r = await result(three);
  const { f, calls } = fakeFetch({});
  await enrichOgImages([r], { fetchImpl: f, perSource: NETWORK_PER_SOURCE });
  assert.ok(!calls.some(c => c.includes('/three/')), 'third article is beyond the cap');
  assert.equal(calls.filter(c => c.endsWith('/one/') || c.endsWith('/two/')).length, 2);
  const nav = await result(item('n', 'Tue, 22 Sep 2026 09:00:00 +0400', 'navyaa.blog'), 'navyaa');
  const bad = { ...r, status: 'unavailable' as const };
  const spy = fakeFetch({});
  const out = await enrichOgImages([nav, bad], { fetchImpl: spy.f, perSource: 2 });
  assert.deepEqual(spy.calls, []);
  assert.deepEqual(out, [nav, bad]);
  const boom = (async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
  await assert.doesNotReject(enrichOgImages([r], { fetchImpl: boom, perSource: 2 }));
});

test('OG helpers: extraction and generic-name detection', () => {
  assert.equal(extractOgImage('<meta content="/a/b.jpg" property="og:image">', 'https://x.test/p/'), 'https://x.test/a/b.jpg');
  assert.equal(extractOgImage('<meta name="twitter:image" content="https://x.test/t.jpg">', 'https://x.test/'), 'https://x.test/t.jpg');
  assert.equal(extractOgImage('<title>none</title>', 'https://x.test/'), null);
  for (const g of ['https://x.test/og-image.png', 'https://x.test/assets/og/og-default.jpg', 'https://x.test/logo.svg', 'https://x.test/apple-touch-icon.png', 'https://x.test/images/default-og-image.jpg'])
    assert.ok(isGenericImageUrl(g), g);
  for (const ok of ['https://x.test/images/uploads/gemini_generated_image_x6s9.jpeg', 'https://zenhomesglobal.com/binghatti-starfall-al-jaddaf/img/hero.jpg'])
    assert.ok(!isGenericImageUrl(ok), ok);
});

// ---- six equal panels ----

test('network panels: five feeds in order plus Join Our Network, capped per source', async () => {
  const dir = path.join(root, 'tests/fixtures/feeds');
  const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(dir, `${s.id}.xml`), 'utf8')]));
  const panels = buildNetworkPanels(await loadAllFeeds({ fixtures, now: NOW }));
  assert.equal(panels.length, 6);
  assert.deepEqual(panels.map(p => p.title), ['OM4BIZ Insights', 'D6 Kitchens Insights', 'Zen Homes Insights', 'Zen Homes Portfolio', 'Design Code Studios Insights', 'Join Our Network']);
  assert.equal(panels[5].kind, 'join');
  for (const p of panels.slice(0, 5)) assert.ok(p.kind === 'feed' && p.items.length <= NETWORK_PER_SOURCE);
  assert.ok(!panels.some(p => p.id === 'navyaa'), 'Navyaa stays in A Different Lens');
});

test('panels still render six when sources are empty or down', async () => {
  const down = await loadAllFeeds({ fixtures: {}, now: NOW });
  const panels = buildNetworkPanels(down);
  assert.equal(panels.length, 6);
  assert.ok(panels.slice(0, 5).every(p => p.kind === 'feed' && p.items.length === 0 && p.status === 'unavailable'));
});

test('panel markup uses a fixed number of slots and the shared grid rules', () => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  assert.match(css, /\.np-grid\{[^}]*repeat\(2,minmax\(0,1fr\)\)[^}]*grid-auto-rows:1fr/);
  assert.match(css, /@media\(max-width:900px\)\{\.np-grid\{grid-template-columns:1fr/);
  const comp = fs.readFileSync(path.join(root, 'src/components/NetworkPanels.tsx'), 'utf8');
  assert.match(comp, /Browse Articles/, 'every feed panel ends with the same compact footer link');
  assert.doesNotMatch(comp, /np-item-empty/, 'no oversized dashed placeholders');
});

// ---- contrast on /network ----

function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('/network text tokens meet contrast targets on paper, white and navy', () => {
  const css = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');
  const tok = (n: string) => new RegExp(`--${n}:(#[0-9a-f]{6})`, 'i').exec(css)![1];
  for (const bg of ['#faf8f4', '#ffffff', '#fbfaf6', '#f0ece3']) {
    assert.ok(ratio(tok('np-ink'), bg) >= 7, `ink on ${bg}`);
    assert.ok(ratio(tok('np-muted'), bg) >= 7, `muted on ${bg}`);
    assert.ok(ratio(tok('np-gold'), bg) >= 5, `gold on ${bg}`);
  }
  assert.ok(ratio('#44515c', '#fbfaf6') >= 7, 'dates');
  assert.ok(ratio('#eef2f6', '#173b60') >= 7, 'join body on navy');
  assert.ok(ratio('#d4deea', '#173b60') >= 4.5, 'join note on navy');
  assert.ok(ratio('#e8d3a2', '#173b60') >= 4.5, 'join kicker on navy');
  assert.ok(ratio('#14283d', '#c7a45b') >= 4.5, 'join button');
  assert.match(css, /\.network-page \.intro\{color:var\(--np-muted\)/, 'the light hero colour is overridden on /network');
});

// ---- Join Our Network: validated preview that never submits ----

const ok = { name: 'A Person', company: 'Example Publishing', email: 'a.person@example.com', website: 'https://example.com', message: 'We publish weekly market notes and would like to talk.' };

test('join validation: required fields, email, https website, message length', () => {
  assert.deepEqual(validateJoin(ok), {});
  assert.deepEqual(validateJoin({ ...ok, website: '' }), {}, 'website is optional');
  assert.deepEqual(Object.keys(validateJoin({ name: ' ', company: '', email: '', website: '', message: '' })).sort(), ['company', 'email', 'message', 'name']);
  for (const email of ['nope', 'a@b', 'a b@c.com', '<x>@c.com', 'a@b.c'])
    assert.ok(validateJoin({ ...ok, email }).email, email);
  for (const website of ['example.com', 'http://example.com', 'javascript:alert(1)', 'https://u:p@example.com', 'https://localhost'])
    assert.ok(validateJoin({ ...ok, website }).website, website);
  assert.ok(validateJoin({ ...ok, message: 'too short' }).message);
  assert.ok(validateJoin({ ...ok, message: 'x'.repeat(2001) }).message);
});

test('join form is a non-submitting preview: no endpoint, network call, mailto or new email automation', () => {
  for (const file of ['src/components/JoinForm.tsx', 'src/lib/joinForm.ts', 'src/app/network/join/page.tsx']) {
    const src = fs.readFileSync(path.join(root, file), 'utf8').replace(/\/\/.*$/gm, '');
    for (const banned of [/fetch\s*\(/, /XMLHttpRequest/, /sendBeacon/, /\baction\s*=/, /method\s*=\s*["']post/i, /formspree|netlify|webhook|api\//i, /window\.location/, /localStorage|sessionStorage/])
      assert.doesNotMatch(src, banned, `${file} ${banned}`);
  }
  const form = fs.readFileSync(path.join(root, 'src/components/JoinForm.tsx'), 'utf8');
  assert.match(form, /e\.preventDefault\(\)/);
  assert.match(form, /Preview only: nothing has been sent or stored/);
  const page = fs.readFileSync(path.join(root, 'src/app/network/join/page.tsx'), 'utf8');
  assert.match(page, /Preview form: not connected yet/);
  assert.equal((page.match(/mailto:/g) ?? []).length, 1, 'only the existing published contact address is offered');
  assert.match(page, /mailto:hello@navvyasignal\.com/);
  assert.match(fs.readFileSync(path.join(root, 'src/app/contact/page.tsx'), 'utf8'), /mailto:hello@navvyasignal\.com/, 'same address as the existing contact page');
});

test('no netlify form detection markup or config was introduced', () => {
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8'), /forms?/i);
  for (const f of ['src/components/JoinForm.tsx', 'src/app/network/join/page.tsx']) assert.doesNotMatch(fs.readFileSync(path.join(root, f), 'utf8'), /data-netlify|netlify-honeypot/);
});
