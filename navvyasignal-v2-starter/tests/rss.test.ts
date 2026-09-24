import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseFeed, parseFeedDate, htmlToText, repairMojibake, cleanUrl, FeedParseError } from '../src/lib/rss/parse.ts';
import { FEED_SOURCES, getSource } from '../src/lib/rss/sources.ts';
import { loadAllFeeds, loadSource, sortAndDedupe } from '../src/lib/rss/service.ts';
import { fetchFeedText, decodeBody } from '../src/lib/rss/fetch.ts';

// Everything here is offline: XML fixtures and injected fetch implementations only.
const dir = path.join(import.meta.dirname, 'fixtures/feeds');
const fx = (name: string) => fs.readFileSync(path.join(dir, name), 'utf8');
const NOW = new Date('2026-09-24T12:00:00Z');
const navyaa = getSource('navyaa')!;
const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fx(`${s.id}.xml`)]));

test('allowlist contains exactly the six verified https feeds', () => {
  assert.deepEqual(FEED_SOURCES.map(s => s.feedUrl), [
    'https://navyaa.blog/feed.xml', 'https://om4biz.com/feed.xml', 'https://d6kitchens.com/feed.xml',
    'https://zenhomesglobal.com/insights/feed.xml', 'https://zenhomesglobal.com/portfolio/feed.xml', 'https://designcode.ae/insights-feed.xml',
  ]);
  for (const s of FEED_SOURCES) assert.ok(s.allowedHosts.includes(new URL(s.feedUrl).hostname), s.id);
});

test('all six representative fixtures parse with no rejections', async () => {
  const results = await loadAllFeeds({ fixtures, now: NOW });
  for (const r of results) { assert.equal(r.status, 'ok', r.source.id); assert.equal(r.rejectedCount, 0, r.source.id); assert.ok(r.items.length >= 1); }
});

test('namespaces: media:content, enclosure, content:encoded and channel images', () => {
  const portfolio = parseFeed(fx('zen-portfolio.xml'), getSource('zen-portfolio')!, NOW).items;
  assert.ok(portfolio.every(i => i.imageUrl?.startsWith('https://zenhomesglobal.com/') && i.imageUrl.endsWith('/img/hero.jpg')), 'enclosure and media:content are preserved');
  const dc = parseFeed(fx('design-code.xml'), getSource('design-code')!, NOW).items[0];
  assert.equal(dc.imageUrl, null, 'channel <image> icon must not become an article image');
  const d6 = parseFeed(fx('d6-kitchens.xml'), getSource('d6-kitchens')!, NOW).items[0];
  assert.equal(d6.imageUrl, null);
  assert.ok(!/<|alert|Full body/.test(d6.excerpt ?? ''), 'excerpt comes from description, not content:encoded HTML');
  const zi = parseFeed(fx('zen-insights.xml'), getSource('zen-insights')!, NOW).items;
  assert.ok(zi.every(i => i.imageUrl === null), 'no image is invented (no OG/site fallback)');
  assert.match(zi[0].excerpt!, /yields & service charges/, 'XML entities decoded once');
});

test('dates: offsets are honoured and never invented', () => {
  const dc = parseFeed(fx('design-code.xml'), getSource('design-code')!, NOW).items[0];
  assert.equal(dc.publishedAt, '2026-09-24T04:00:00.000Z');
  assert.deepEqual(parseFeedDate('Thu, 24 Sep 2026 00:00:00 +0000', NOW), { iso: '2026-09-24T00:00:00.000Z' });
  assert.deepEqual(parseFeedDate('2026-09-15T10:00:00+05:30', NOW), { iso: '2026-09-15T04:30:00.000Z' });
  assert.deepEqual(parseFeedDate('2026-09-15', NOW), { iso: '2026-09-15T00:00:00.000Z' });
  assert.deepEqual(parseFeedDate('', NOW), { error: 'missing-date' });
  assert.deepEqual(parseFeedDate('yesterday', NOW), { error: 'invalid-date' });
  assert.deepEqual(parseFeedDate('Mon, 21 Sep 2026 10:00:00', NOW), { error: 'invalid-date' }); // no zone => ambiguous
  assert.deepEqual(parseFeedDate('Tue, 31 Feb 2026 10:00:00 GMT', NOW), { error: 'invalid-date' });
  assert.deepEqual(parseFeedDate('Mon, 21 Sep 2099 10:00:00 GMT', NOW), { error: 'future-date' });
});

const edge = parseFeed(fx('edge-cases.xml'), navyaa, NOW);
const reasons = (i: number) => edge.rejected.find(r => r.index === i)?.reason;

test('edge cases: missing/invalid dates, invalid links and missing titles are rejected', () => {
  const byTitle = (t: string) => edge.items.find(i => i.title === t);
  for (const t of ['No date at all', 'Bad date text', 'Impossible calendar date', 'Zoneless date', 'Far future date', 'javascript link', 'http link', 'Foreign host', 'Credentialed link', 'Missing link'])
    assert.equal(byTitle(t), undefined, t);
  assert.equal(reasons(2), 'missing-date');
  assert.equal(reasons(3), 'invalid-date');
  assert.equal(reasons(6), 'future-date');
  assert.equal(reasons(7), 'invalid-link');
  assert.equal(reasons(11), 'invalid-link');
  assert.equal(reasons(12), 'missing-title');
  assert.equal(edge.totalItems, edge.items.length + edge.rejected.length);
});

test('CDATA + HTML is reduced to safe plain text', () => {
  const item = edge.items.find(i => i.title === 'Valid CDATA item')!;
  assert.equal(item.excerpt, 'Hello world & friends');
  assert.equal(item.url, 'https://navyaa.blog/valid/?a=1', 'tracking params and fragment removed');
  assert.equal(htmlToText('<p>a</p><script>bad()</script>b<iframe src=x></iframe><!-- c -->c<img onerror="x>y"> d'), 'a b c d');
  assert.equal(htmlToText('x<script>never closed'), 'x');
  assert.equal(htmlToText('&#60;b&#62; &#x26; &bogus; &#1;'), '<b> & &bogus;');
  assert.equal(htmlToText('line one<br>line two</li><li>three'), 'line one line two three');
});

test('titles keep legitimate punctuation untouched', () => {
  assert.equal(edge.items.find(i => i.url.endsWith('/quotes/'))!.title, 'Fancy & "quoted" title, 5 < 6');
});

test('duplicates collapse on canonical URL and the newest copy wins', () => {
  const dupes = edge.items.filter(i => i.canonicalUrl === 'https://navyaa.blog/valid?a=1');
  assert.equal(dupes.length, 2, 'parser keeps both; dedupe is the service step');
  const out = sortAndDedupe(edge.items).filter(i => i.canonicalUrl === 'https://navyaa.blog/valid?a=1');
  assert.equal(out.length, 1);
  assert.equal(out[0].title, 'Valid CDATA item');
});

test('equal timestamps are ordered deterministically regardless of feed order', () => {
  const tie = edge.items.filter(i => i.title.startsWith('Tie '));
  assert.equal(tie[0].publishedAt, tie[1].publishedAt);
  const a = sortAndDedupe(edge.items).map(i => i.title);
  const b = sortAndDedupe([...edge.items].reverse()).map(i => i.title);
  assert.deepEqual(a, b);
  assert.ok(a.indexOf('Tie A') < a.indexOf('Tie B'));
  const sorted = sortAndDedupe(edge.items).map(i => i.publishedAt);
  assert.deepEqual(sorted, [...sorted].sort().reverse());
});

test('images: only https, allowlisted-host, article-level images with an image type', () => {
  assert.equal(edge.items.find(i => i.title === 'Image handling')!.imageUrl, 'https://navyaa.blog/img/relative.jpg');
  assert.equal(edge.items.find(i => i.title === 'Video is not an image')!.imageUrl, null);
});

test('Atom entries are supported and rel=alternate is used', () => {
  const [e] = parseFeed(fx('atom.xml'), navyaa, NOW).items;
  assert.equal(e.url, 'https://navyaa.blog/atom-entry/');
  assert.equal(e.publishedAt, '2026-09-15T10:00:00.000Z');
  assert.equal(e.excerpt, 'Atom summary text.');
});

test('malformed XML, DOCTYPE and wrong root throw FeedParseError; empty feed is valid', () => {
  assert.throws(() => parseFeed(fx('malformed.xml'), navyaa, NOW), (e: any) => e instanceof FeedParseError && e.code === 'malformed-xml');
  assert.throws(() => parseFeed(fx('doctype.xml'), navyaa, NOW), (e: any) => e.code === 'doctype-forbidden');
  assert.throws(() => parseFeed('', navyaa, NOW), (e: any) => e.code === 'empty-document');
  assert.throws(() => parseFeed('<html><body>hi</body></html>', navyaa, NOW), (e: any) => e.code === 'unsupported-format');
  assert.deepEqual(parseFeed(fx('empty-feed.xml'), navyaa, NOW), { items: [], rejected: [], totalItems: 0 });
});

test('mojibake repair is strict: only whole-string UTF-8 round trips change', () => {
  const broken = 'burnout â€” it’s'; // dash mis-decoded
  assert.equal(repairMojibake('burnout â€” it').text, 'burnout — it');
  assert.equal(repairMojibake('burnout â€” it').repaired, true);
  assert.equal(repairMojibake(broken).repaired, false, 'a genuine curly apostrophe elsewhere blocks any guess');
  for (const legit of ['Ras Malé', 'Café Âge', 'Plain ASCII', 'Em dash — fine', 'Ã alone'])
    assert.deepEqual(repairMojibake(legit), { text: legit, repaired: false }, legit);
  const [item] = parseFeed(fx('navyaa.xml'), navyaa, NOW).items.filter(i => i.encodingRepaired);
  assert.match(item.excerpt!, /broken — the dash/);
  assert.equal(item.title, 'Fixture: Stillness After the Pavement Ends');
});

test('cleanUrl enforces https, host allowlist and no credentials', () => {
  const h = navyaa.allowedHosts;
  assert.equal(cleanUrl('https://navyaa.blog/a/', h)!.canonical, 'https://navyaa.blog/a');
  assert.equal(cleanUrl('https://WWW.navyaa.blog/a?utm_x=1&b=2', h)!.url, 'https://www.navyaa.blog/a?b=2');
  assert.equal(cleanUrl('/rel', h, 'https://navyaa.blog/x/')!.url, 'https://navyaa.blog/rel');
  for (const bad of ['http://navyaa.blog/', 'https://navyaa.blog.evil.example/', 'https://user@navyaa.blog/', 'https://navyaa.blog:8443/', 'javascript:alert(1)', 'data:text/html,x', '', 'https://navyaa.blog/a b', null, 42])
    assert.equal(cleanUrl(bad, h), null, String(bad));
});

// ---------- fetch resilience ----------

const xmlResponse = (body: string, init: ResponseInit = {}) => new Response(body, { status: 200, headers: { 'content-type': 'application/xml; charset=utf-8' }, ...init });

test('temporary outages are isolated per source and never throw', async () => {
  const fetchImpl = (async (url: string) => {
    if (url.includes('navyaa')) return new Response('down', { status: 503 });
    if (url.includes('om4biz')) throw new TypeError('fetch failed');
    if (url.includes('d6kitchens')) return new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    if (url.includes('insights/feed')) return xmlResponse(fx('malformed.xml'));
    if (url.includes('portfolio')) return xmlResponse(fx('empty-feed.xml'));
    return xmlResponse(fx('design-code.xml'));
  }) as unknown as typeof fetch;
  const r = Object.fromEntries((await loadAllFeeds({ fetchImpl, now: NOW })).map(x => [x.source.id, x]));
  assert.equal(r['navyaa'].status, 'unavailable'); assert.match(r['navyaa'].error!, /^http-status/);
  assert.match(r['om4biz'].error!, /^network/);
  assert.match(r['d6-kitchens'].error!, /^content-type/);
  assert.match(r['zen-insights'].error!, /^malformed-xml/);
  assert.equal(r['zen-portfolio'].status, 'empty');
  assert.equal(r['design-code'].status, 'ok');
  assert.equal(r['design-code'].items.length, 1);
  assert.ok(Object.values(r).every(x => x.retrievedAt === NOW.toISOString()));
});

test('timeouts abort a hanging source', async () => {
  const fetchImpl = ((_u: string, init: RequestInit) => new Promise((_res, rej) => init.signal!.addEventListener('abort', () => rej(init.signal!.reason)))) as unknown as typeof fetch;
  const r = await loadSource(navyaa, { fetchImpl, timeoutMs: 25, now: NOW });
  assert.equal(r.status, 'unavailable');
  assert.match(r.error!, /^timeout/);
});

test('oversized bodies are refused (declared and streamed)', async () => {
  const big = 'x'.repeat(5000);
  await assert.rejects(fetchFeedText(navyaa, { maxBytes: 1000, fetchImpl: (async () => xmlResponse(big, { headers: { 'content-type': 'application/xml', 'content-length': '5000' } })) as unknown as typeof fetch }), /Declared size/);
  await assert.rejects(fetchFeedText(navyaa, { maxBytes: 1000, fetchImpl: (async () => xmlResponse(big)) as unknown as typeof fetch }), /exceeds/);
});

test('redirects must stay https on allowed hosts', async () => {
  const seen: string[] = [];
  const ok = (async (url: string) => {
    seen.push(url);
    return url === 'https://navyaa.blog/feed.xml' ? new Response(null, { status: 301, headers: { location: 'https://www.navyaa.blog/feed.xml' } }) : xmlResponse(fx('empty-feed.xml'));
  }) as unknown as typeof fetch;
  await fetchFeedText(navyaa, { fetchImpl: ok });
  assert.deepEqual(seen, ['https://navyaa.blog/feed.xml', 'https://www.navyaa.blog/feed.xml']);
  for (const location of ['https://evil.example/feed.xml', 'http://navyaa.blog/feed.xml', 'https://u:p@navyaa.blog/feed.xml'])
    await assert.rejects(fetchFeedText(navyaa, { fetchImpl: (async () => new Response(null, { status: 302, headers: { location } })) as unknown as typeof fetch }), /redirect/i, location);
  await assert.rejects(fetchFeedText(navyaa, { fetchImpl: (async () => new Response(null, { status: 302, headers: { location: '/feed.xml' } })) as unknown as typeof fetch }), /redirect/i, 'redirect loop is capped');
});

test('body decoding honours the XML prolog encoding', () => {
  const latin1 = Uint8Array.from(Buffer.from('<?xml version="1.0" encoding="ISO-8859-1"?><t>café</t>', 'latin1'));
  assert.match(decodeBody(latin1, 'application/xml'), /café/);
  assert.match(decodeBody(Uint8Array.from(Buffer.from('<t>café</t>', 'utf8')), 'application/xml'), /café/);
});

test('cross-source dedupe keeps a URL once, preferring the earlier allowlist entry', async () => {
  const shared = (host: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title><item><title>Same</title><link>https://${host}/same/</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>`;
  const zi = getSource('zen-insights')!, zp = getSource('zen-portfolio')!;
  const r = await loadAllFeeds({ sources: [zi, zp], fixtures: { 'zen-insights': shared('zenhomesglobal.com'), 'zen-portfolio': shared('zenhomesglobal.com') }, now: NOW });
  assert.equal(r[0].items.length, 1);
  assert.equal(r[1].items.length, 0);
  assert.equal(r[1].status, 'empty');
});
