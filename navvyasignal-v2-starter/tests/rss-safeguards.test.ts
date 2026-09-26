import test from 'node:test';
import assert from 'node:assert/strict';
import { getSource } from '../src/lib/rss/sources.ts';
import { loadSource, loadAllFeeds, feedWarning } from '../src/lib/rss/service.ts';
import { resolveFixtureMode, isNetlifyBuild } from '../src/lib/rss/env.ts';

const NOW = new Date('2026-09-24T12:00:00Z');
const navyaa = getSource('navyaa')!;
const wrap = (items: string) => `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items}</channel></rss>`;

// ---- safeguard 1: all-rejected feeds are distinguished and logged without untrusted content ----

const SECRET = 'UNTRUSTED-TITLE-<script>alert(1)</script>';
const allBad = wrap(
  `<item><title>${SECRET.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title><link>https://evil.example/steal?token=abc123</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate></item>` +
  '<item><title>No date</title><link>https://navyaa.blog/a/</link></item>' +
  '<item><title>Also no date</title><link>https://navyaa.blog/b/</link></item>');

test('feed with entries that are all rejected is all-rejected, not empty', async () => {
  const r = await loadSource(navyaa, { fixtures: { navyaa: allBad }, now: NOW });
  assert.equal(r.status, 'all-rejected');
  assert.equal(r.totalEntries, 3);
  assert.equal(r.rejectedCount, 3);
  assert.deepEqual(r.rejectedReasons, { 'invalid-link': 1, 'missing-date': 2 });
});

test('genuinely empty feed stays empty and produces no warning', async () => {
  const r = await loadSource(navyaa, { fixtures: { navyaa: wrap('') }, now: NOW });
  assert.equal(r.status, 'empty');
  assert.equal(r.totalEntries, 0);
  assert.equal(feedWarning(r), null);
});

test('all-rejected warning reports counts and reason codes only, never article content', async () => {
  const r = await loadSource(navyaa, { fixtures: { navyaa: allBad }, now: NOW });
  const w = feedWarning(r)!;
  assert.match(w, /^\[rss\] navyaa: feed has 3 entries but all 3 were rejected \(invalid-link=1, missing-date=2\)/);
  for (const leak of ['UNTRUSTED', 'script', 'evil.example', 'token', 'abc123', 'navyaa.blog/a', 'No date']) assert.ok(!w.includes(leak), leak);
  assert.ok(!w.includes('\n'));
});

test('partially valid, unavailable and ok feeds are classified distinctly', async () => {
  const mixed = wrap('<item><title>Good</title><link>https://navyaa.blog/g/</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate></item><item><title>Bad</title><link>https://navyaa.blog/x/</link></item>');
  const ok = await loadSource(navyaa, { fixtures: { navyaa: mixed }, now: NOW });
  assert.equal(ok.status, 'ok'); assert.equal(ok.rejectedCount, 1); assert.equal(feedWarning(ok), null);
  const down = await loadSource(navyaa, { fixtures: { navyaa: '<not xml' }, now: NOW });
  assert.equal(down.status, 'unavailable');
  assert.match(feedWarning(down)!, /^\[rss\] navyaa unavailable at build: malformed-xml/);
});

test('cross-source duplicates do not turn an ok source into all-rejected', async () => {
  const one = (h: string) => wrap(`<item><title>Same</title><link>https://${h}/same/</link><pubDate>Mon, 21 Sep 2026 10:00:00 GMT</pubDate></item>`);
  const r = await loadAllFeeds({ sources: [getSource('zen-insights')!, getSource('zen-portfolio')!], fixtures: { 'zen-insights': one('zenhomesglobal.com'), 'zen-portfolio': one('zenhomesglobal.com') }, now: NOW });
  assert.equal(r[1].status, 'empty');
  assert.equal(feedWarning(r[1]), null);
});

// ---- safeguard 2: fixtures can never reach a real Netlify deployment ----

const NETLIFY_ENVS = [
  { NETLIFY: 'true' }, { NETLIFY_BUILD_BASE: '/opt/buildhome' }, { DEPLOY_ID: '66aa' },
  { NETLIFY: 'true', CONTEXT: 'production' }, { NETLIFY: 'true', CONTEXT: 'deploy-preview' },
];
const REQUESTS = [{ V2_RSS_FIXTURES: '1' }, { CI: 'true', V2_CI_STATIC_FIXTURE: '1' }, { V2_RSS_FIXTURES: '1', CI: 'true', V2_CI_STATIC_FIXTURE: '1' }];

test('fixture mode is refused on every Netlify signal, however it is requested', () => {
  for (const n of NETLIFY_ENVS) for (const req of REQUESTS) {
    const r = resolveFixtureMode({ ...n, ...req });
    assert.deepEqual(r, { useFixtures: false, blocked: true }, JSON.stringify({ ...n, ...req }));
  }
  assert.ok(isNetlifyBuild({ NETLIFY: 'true' }));
});

test('deterministic offline CI still uses fixtures (GitHub Actions and local flags)', () => {
  assert.deepEqual(resolveFixtureMode({ CI: 'true', V2_CI_STATIC_FIXTURE: '1', GITHUB_ACTIONS: 'true' }), { useFixtures: true, blocked: false });
  assert.deepEqual(resolveFixtureMode({ V2_RSS_FIXTURES: '1' }), { useFixtures: true, blocked: false });
});

test('without a request, or with the =0 override, live feeds are used and nothing is flagged', () => {
  for (const env of [{}, { CI: 'true' }, { V2_CI_STATIC_FIXTURE: '1' }, { V2_RSS_FIXTURES: '0', CI: 'true', V2_CI_STATIC_FIXTURE: '1' }, { NETLIFY: 'true' }, { NETLIFY: 'true', V2_RSS_FIXTURES: '0' }])
    assert.deepEqual(resolveFixtureMode(env), { useFixtures: false, blocked: false }, JSON.stringify(env));
});
