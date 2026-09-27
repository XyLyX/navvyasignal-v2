const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./helpers/loadTs.cjs');

const mod = load('notion');
const { getStories, getLongReadBlocks, MAX_NOTION_PAGES } = mod;

const TOKEN_ENV = { NOTION_TOKEN: 'secret_x', NOTION_DATA_SOURCE_ID: 'ds-1', NODE_ENV: 'production' };
const noSleep = async () => {};
const R = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: { get: k => headers[k.toLowerCase()] ?? null }, json: async () => body });
const page = (id, over = {}) => ({ id, created_time: over.created ?? '2026-09-26T08:00:00.000Z', properties: {
  Name: { title: [{ plain_text: over.title ?? `T-${id}` }] }, 'Ready to Post': { checkbox: over.ready ?? true },
  'Signal Brief': { rich_text: [{ plain_text: 'brief' }] }, 'Text 1': { rich_text: [{ plain_text: 'src' }] },
  Category: { select: { name: 'UAE Desk' } }, "Today's Intelligence": { checkbox: !!over.today },
  'Homepage Date': { date: over.date ? { start: over.date } : null }, 'Homepage Priority': { number: over.priority ?? null } } });

// A fake Notion that serves `rows` in pages of `size`, recording every request body.
function server(rows, size = 100) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body); calls.push({ url, body, headers: init.headers });
    const start = body.start_cursor ? Number(body.start_cursor) : 0;
    const slice = rows.slice(start, start + size);
    const next = start + size < rows.length ? String(start + size) : null;
    return R(200, { results: slice, has_more: next !== null, next_cursor: next });
  };
  return { calls, fetchImpl };
}

// ---- credentials ----
test('production build without credentials FAILS instead of producing an empty site', async () => {
  for (const env of [{ NODE_ENV: 'production' }, { NODE_ENV: 'production', NOTION_TOKEN: 'x' },
    { NODE_ENV: 'production', NOTION_DATA_SOURCE_ID: 'ds' }, { NODE_ENV: 'production', NOTION_TOKEN: '', NOTION_DATA_SOURCE_ID: '' }]) {
    await assert.rejects(getStories({ env, fetchImpl: async () => { throw new Error('must not fetch'); } }), /V2 build refused/);
  }
});

test('the error names what is missing', async () => {
  await assert.rejects(getStories({ env: { NODE_ENV: 'production', NOTION_TOKEN: 'x' } }), /NOTION_DATA_SOURCE_ID not configured/);
});

test('credential-free CI fixture only under explicit CI flags', async () => {
  const ci = await getStories({ env: { NODE_ENV: 'production', CI: 'true', V2_CI_STATIC_FIXTURE: '1', NOTION_TOKEN: '', NOTION_DATA_SOURCE_ID: '' } });
  assert.deepEqual(Array.from(ci, s => s.id), ['ci-static-fixture']);
  await assert.rejects(getStories({ env: { NODE_ENV: 'production', V2_CI_STATIC_FIXTURE: '1' } }), /V2 build refused/);   // flag alone is not enough
  await assert.rejects(getStories({ env: { NODE_ENV: 'production', CI: 'true' } }), /V2 build refused/);
});

test('local development without credentials stays usable (empty, never a production build)', async () => {
  assert.deepEqual(Array.from(await getStories({ env: { NODE_ENV: 'development' } })), []);
});

test('long-read block fetch is also fail-closed in production', async () => {
  await assert.rejects(getLongReadBlocks('3e711486-b145-8000-0000-000000000001', { env: { NODE_ENV: 'production' } }), /V2 build refused/);
});

// ---- fail-closed HTTP ----
test('HTTP errors fail the build (no partial result)', async () => {
  for (const status of [400, 401, 403, 404, 500]) {
    await assert.rejects(getStories({ env: TOKEN_ENV, sleep: noSleep, fetchImpl: async () => R(status, {}) }), new RegExp(`HTTP ${status}`));
  }
});

test('a failure on a later page fails the whole read', async () => {
  let n = 0;
  const fetchImpl = async () => (++n === 1 ? R(200, { results: [page('a')], has_more: true, next_cursor: 'c1' }) : R(500, {}));
  await assert.rejects(getStories({ env: TOKEN_ENV, sleep: noSleep, fetchImpl }), /HTTP 500/);
});

test('transient 429/503 are retried (bounded) and then succeed', async () => {
  let n = 0, waits = [];
  const fetchImpl = async () => (++n <= 2 ? R(n === 1 ? 429 : 503, {}, { 'retry-after': '1' }) : R(200, { results: [page('a')], has_more: false, next_cursor: null }));
  const out = await getStories({ env: TOKEN_ENV, sleep: async ms => { waits.push(ms); }, fetchImpl });
  assert.equal(out.length, 1); assert.equal(n, 3); assert.equal(waits.length, 2);
});

test('retries are bounded: persistent 429 still fails closed', async () => {
  let n = 0;
  await assert.rejects(getStories({ env: TOKEN_ENV, sleep: noSleep, fetchImpl: async () => { n++; return R(429, {}); } }), /HTTP 429/);
  assert.equal(n, 3);   // first try + 2 retries
});

test('non-retryable statuses are not retried', async () => {
  let n = 0;
  await assert.rejects(getStories({ env: TOKEN_ENV, sleep: noSleep, fetchImpl: async () => { n++; return R(401, {}); } }), /HTTP 401/);
  assert.equal(n, 1);
});

// ---- deterministic, complete retrieval ----
test('request is a server-side Ready filter with an explicit created_time sort and current API version', async () => {
  const s = server([page('a')]);
  await getStories({ env: TOKEN_ENV, fetchImpl: s.fetchImpl });
  const c = s.calls[0];
  assert.match(c.url, /\/v1\/data_sources\/ds-1\/query$/);
  assert.deepEqual(c.body.filter, { property: 'Ready to Post', checkbox: { equals: true } });
  assert.deepEqual(c.body.sorts, [{ timestamp: 'created_time', direction: 'descending' }]);
  assert.equal(c.body.page_size, 100);
  assert.equal(c.headers['Notion-Version'], '2025-09-03');
});

test('no 800-story cap: 2,350 approved stories across 24 pages are ALL returned', async () => {
  const rows = Array.from({ length: 2350 }, (_, i) => page(`id-${String(i).padStart(5, '0')}`, { created: new Date(Date.UTC(2026, 8, 26, 0, 0, i)).toISOString() }));
  const s = server(rows);
  const out = await getStories({ env: TOKEN_ENV, fetchImpl: s.fetchImpl });
  assert.equal(out.length, 2350); assert.equal(s.calls.length, 24);
  assert.equal(new Set(out.map(x => x.id)).size, 2350);
});

test('result order is deterministic: newest first, id tie-break, regardless of Notion page order', async () => {
  const rows = [page('b', { created: '2026-09-26T08:00:00Z' }), page('a', { created: '2026-09-26T08:00:00Z' }), page('c', { created: '2026-09-27T08:00:00Z' })];
  const forward = await getStories({ env: TOKEN_ENV, fetchImpl: server(rows).fetchImpl });
  const reversed = await getStories({ env: TOKEN_ENV, fetchImpl: server([...rows].reverse()).fetchImpl });
  assert.deepEqual(Array.from(forward, s => s.id), ['c', 'a', 'b']);
  assert.deepEqual(Array.from(reversed, s => s.id), ['c', 'a', 'b']);
});

test('duplicates across pages collapse; unapproved, test and duplicate-titled rows are dropped', async () => {
  const rows = [page('a'), page('a'), page('u', { ready: false }), page('t', { title: '[TEST] x' }), page('d', { title: '[DUPLICATE] y' }), page('n', { title: '' }), page('ok')];
  const out = await getStories({ env: TOKEN_ENV, fetchImpl: server(rows, 3).fetchImpl });
  assert.deepEqual(new Set(Array.from(out, s => s.id)), new Set(['a', 'ok']));
});

test('homepage metadata is mapped exactly (flag, date, numeric priority)', async () => {
  const [s] = await getStories({ env: TOKEN_ENV, fetchImpl: server([page('a', { today: true, date: '2026-09-26T10:00:00.000+04:00', priority: 3 })]).fetchImpl });
  assert.equal(s.today, true); assert.equal(s.homepageDate, '2026-09-26'); assert.equal(s.homepagePriority, 3);
});

// ---- truncation guards ----
test('has_more without a cursor aborts instead of silently truncating', async () => {
  await assert.rejects(getStories({ env: TOKEN_ENV, fetchImpl: async () => R(200, { results: [page('a')], has_more: true, next_cursor: null }) }), /has_more without next_cursor/);
});

test('a repeating cursor aborts instead of looping forever', async () => {
  await assert.rejects(getStories({ env: TOKEN_ENV, fetchImpl: async () => R(200, { results: [page('a')], has_more: true, next_cursor: 'same' }) }), /cursor repeated/);
});

test('the safety ceiling fails the build rather than dropping approved stories', async () => {
  let n = 0;
  const fetchImpl = async () => R(200, { results: [page(`p${n}`)], has_more: true, next_cursor: `c${++n}` });
  await assert.rejects(getStories({ env: TOKEN_ENV, fetchImpl }), /more than \d+ approved stories/);
  assert.equal(n, MAX_NOTION_PAGES);
});
