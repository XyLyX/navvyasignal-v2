const test = require('node:test');
const assert = require('node:assert/strict');
const bridge = require('../../insights/notion-bridge.cjs');
const discovery = require('../../insights/discovery.cjs');
const part1 = require('./fixtures/insights/part1.cjs');

const NOW = new Date('2026-11-20T10:00:00Z');
const clone = (o) => JSON.parse(JSON.stringify(o));
const rt = (s) => ({ rich_text: [{ plain_text: s }] });
const FP = 'Approval Fingerprint';

// Part 1's real record plus the (not yet created) Approval Fingerprint property.
function withFingerprintProp(page) { const p = clone(page); p.properties[FP] = { rich_text: [] }; return p; }
function record(mutate, blocks = part1.blocks) {
  const page = withFingerprintProp(part1.page);
  if (mutate) mutate(page.properties);
  return bridge.normalizePage(page, blocks);
}
const sourcesOk = (p) => { p.Sources = rt('The Economist | https://www.economist.com/the-world-ahead'); };
// A fully eligible, approved revision of the same content.
function eligible(extra) {
  let r = record((p) => {
    sourcesOk(p); p.Status = { select: { name: 'Approved' } }; p['Ready to Post'] = { checkbox: true };
    p['Verification Status'] = { select: { name: 'Verified' } }; p['Publish At'] = { date: { start: '2026-01-15' } };
    if (extra) extra(p);
  });
  r.approvalFingerprint = r.fingerprint;
  return r;
}
const reasons = (r) => bridge.evaluate(r, NOW).reasons;

// ---------------- positive control ----------------
test('positive control: a fully approved, verified, fingerprinted revision is eligible and appears in every output', () => {
  const r = eligible();
  assert.deepEqual(reasons(r), []);
  const { articles } = bridge.buildSnapshot([r], { now: NOW });
  assert.equal(articles.length, 1);
  const a = articles[0];
  assert.equal(a.category, 'Analysis'); assert.equal(a.desk, 'Cross-Desk'); assert.equal(a.status, 'Published');
  assert.match(discovery.rss(articles), /the-world-ahead-2027-converging-risks/);
  assert.match(discovery.sitemap(articles), /the-world-ahead-2027-converging-risks/);
  assert.equal(discovery.metadata(a).jsonLd.headline, a.title);
  assert.equal(discovery.publishedArticles(articles).length, 1);
});

// ---------------- negative case A: the actual Part 1 record ----------------
test('negative A: the actual Part 1 record is excluded everywhere and every blocking reason is reported', () => {
  const r = bridge.normalizePage(part1.page, part1.blocks); // real record: no Approval Fingerprint property yet
  const v = bridge.evaluate(r, NOW);
  assert.equal(v.eligible, false);
  for (const reason of ['status_not_approved', 'ready_to_post_unchecked', 'verification_not_verified', 'approval_fingerprint_missing',
    'sources_missing_url', 'missing_publication_date', 'missing_property:Approval Fingerprint']) assert.ok(v.reasons.includes(reason), reason);
  const { articles, excluded } = bridge.buildSnapshot([r], { now: NOW });
  assert.equal(articles.length, 0);
  assert.equal(excluded.length, 1);
  assertNothingPublic(articles, [r]);
});

// ---------------- negative case B: approval checkbox + status alone ----------------
test('negative B: Approved + Ready to Post checked but Partially Verified stays out', () => {
  const r = eligible((p) => { p['Verification Status'] = { select: { name: 'Partially Verified' } }; });
  assert.deepEqual(reasons(r), ['verification_not_verified']);
  assertNothingPublic(bridge.buildSnapshot([r], { now: NOW }).articles, [r]);
});
test('negative B2: Approved + Ready + Verified but no recorded fingerprint (checkbox-only approval) stays out', () => {
  const r = eligible(); r.approvalFingerprint = '';
  assert.deepEqual(reasons(r), ['approval_fingerprint_missing']);
  assertNothingPublic(bridge.buildSnapshot([r], { now: NOW }).articles, [r]);
});
test('negative B3: the real Part 1 content with every checkbox flipped on still cannot publish without a fingerprint', () => {
  const page = clone(part1.page);
  page.properties.Status = { select: { name: 'Approved' } }; page.properties['Ready to Post'] = { checkbox: true };
  page.properties['Verification Status'] = { select: { name: 'Verified' } };
  const r = bridge.normalizePage(page, part1.blocks);
  assert.equal(bridge.evaluate(r, NOW).eligible, false);
  assertNothingPublic(bridge.buildSnapshot([r], { now: NOW }).articles, [r]);
});

// ---------------- gates, one at a time ----------------
test('each gate blocks independently', () => {
  const base = eligible();
  assert.deepEqual(reasons(base), []);
  const cases = [
    [(p) => { p.Status = { select: { name: 'In Review' } }; }, 'status_not_approved'],
    [(p) => { p.Status = { select: { name: 'Draft' } }; }, 'status_not_approved'],
    [(p) => { p.Status = { select: { name: 'Archived' } }; }, 'status_not_approved'],
    [(p) => { p['Ready to Post'] = { checkbox: false }; }, 'ready_to_post_unchecked'],
    [(p) => { p['Verification Status'] = { select: { name: 'Pending' } }; }, 'verification_not_verified'],
    [(p) => { p['Verification Status'] = { select: { name: 'Failed' } }; }, 'verification_not_verified'],
    [(p) => { p['Publish At'] = { date: { start: '2026-12-31' } }; }, 'scheduled_in_future'],
    [(p) => { p['Publish At'] = { date: null }; }, 'missing_publication_date'],
    [(p) => { p.Slug = rt('Bad Slug!'); }, 'invalid_slug'],
    [(p) => { p.Author = rt(''); }, 'missing_author'],
    [(p) => { p.Sources = rt('no url here'); }, 'sources_missing_url'],
    [(p) => { p.Sources = rt('http://insecure.example/x'); }, 'sources_missing_url'],
    [(p) => { p['Hero Image URL'] = { url: 'https://img.example/a.jpg' }; }, 'hero_requires_https_and_alt']
  ];
  for (const [mutate, expected] of cases) assert.ok(reasons(eligible(mutate)).includes(expected), expected);
});
test('unsupported or nested body blocks fail closed', () => {
  const embed = { type: 'embed', has_children: false, embed: { url: 'https://x.example' } };
  assert.ok(reasons(eligible(null)).length === 0);
  const r = record((p) => { sourcesOk(p); p.Status = { select: { name: 'Approved' } }; p['Ready to Post'] = { checkbox: true };
    p['Verification Status'] = { select: { name: 'Verified' } }; p['Publish At'] = { date: { start: '2026-01-15' } }; }, [...part1.blocks, embed]);
  r.approvalFingerprint = r.fingerprint;
  assert.ok(reasons(r).includes('unsupported_block:embed'));
  const nested = clone(part1.blocks); nested[0].has_children = true;
  assert.ok(bridge.blocksToParagraphs(nested).problems.includes('unsupported_nested_blocks'));
});
test('duplicate slugs exclude both articles', () => {
  const a = eligible(), b = eligible(); b.id = 'other-id';
  const { articles, excluded } = bridge.buildSnapshot([a, b], { now: NOW });
  assert.equal(articles.length, 0);
  assert.ok(excluded.every((e) => e.reasons.includes('duplicate_slug')));
});

// ---------------- fail-closed mappings ----------------
test('category mapping is explicit: Notion values map to display values; anything else is ineligible', () => {
  assert.deepEqual({ ...bridge.CATEGORY_MAP }, { 'Analysis': 'Analysis', 'Explainer': 'Explainers', 'The World Ahead': 'The World Ahead', 'Special Report': 'Special Reports' });
  for (const [notion, display] of Object.entries(bridge.CATEGORY_MAP)) {
    const r = eligible((p) => { p.Category = { select: { name: notion } }; });
    assert.deepEqual(reasons(r), []); assert.equal(bridge.toPublic(r).category, display);
  }
  for (const bad of ['Explainers', 'Special Reports', 'Opinion', '']) assert.ok(reasons(eligible((p) => { p.Category = { select: bad ? { name: bad } : null }; })).includes('unmapped_category'), bad);
});
test('editorial scope mapping is explicit and fail-closed', () => {
  for (const scope of Object.keys(bridge.SCOPE_MAP)) assert.deepEqual(reasons(eligible((p) => { p['Editorial Scope'] = { multi_select: [{ name: scope }] }; })), []);
  assert.deepEqual(bridge.toPublic(eligible((p) => { p['Editorial Scope'] = { multi_select: [{ name: 'Europe' }, { name: 'India & Subcontinent' }] }; })).desk, 'Europe · India & Subcontinent');
  assert.ok(reasons(eligible((p) => { p['Editorial Scope'] = { multi_select: [] }; })).includes('unmapped_or_missing_scope'));
  assert.ok(reasons(eligible((p) => { p['Editorial Scope'] = { multi_select: [{ name: 'Europe' }, { name: 'Antarctica' }] }; })).includes('unmapped_or_missing_scope'));
});
test('a missing database property fails closed instead of publishing', () => {
  const page = withFingerprintProp(part1.page); delete page.properties['Verification Status'];
  const r = bridge.normalizePage(page, part1.blocks);
  assert.ok(r.structuralProblems.includes('missing_property:Verification Status'));
  assert.equal(bridge.evaluate(r, NOW).eligible, false);
});

// ---------------- content fingerprint ----------------
test('fingerprint covers Title, BLUF, body and Sources only', () => {
  const base = eligible();
  const changed = (mutate, blocks) => { const r = record((p) => { sourcesOk(p); mutate(p); }, blocks); return r.fingerprint; };
  const baseFp = changed(() => {});
  assert.equal(baseFp, base.fingerprint);
  assert.notEqual(changed((p) => { p.Title = rt('Another title'); }), baseFp);
  assert.notEqual(changed((p) => { p['Subtitle / BLUF'] = rt('A different BLUF.'); }), baseFp);
  assert.notEqual(changed((p) => { p.Sources = rt('The Economist | https://www.economist.com/other'); }), baseFp);
  const edited = clone(part1.blocks); edited[2].heading_2.rich_text[0].plain_text += '!';
  assert.notEqual(changed(() => {}, edited), baseFp);
  const edited2 = clone(part1.blocks); edited2[0].paragraph.rich_text[0].plain_text += ' ';
  assert.equal(changed(() => {}, edited2), baseFp); // whitespace-only edit is not material
  // metadata edits (including the approval actions themselves) do not invalidate approval
  for (const m of [(p) => { p['Updated At'] = { date: { start: '2026-12-01' } }; }, (p) => { p['SEO Title'] = rt('x'); }, (p) => { p['Editorial Notes'] = rt('new private note'); },
    (p) => { p.Status = { select: { name: 'Approved' } }; }, (p) => { p['Ready to Post'] = { checkbox: true }; }, (p) => { p['Verification Status'] = { select: { name: 'Verified' } }; }, (p) => { p.Slug = rt('another-slug'); }])
    assert.equal(changed(m), baseFp);
});
test('a material edit after approval invalidates approval', () => {
  const approved = eligible();
  const page = withFingerprintProp(part1.page);
  Object.assign(page.properties, { Sources: rt('The Economist | https://www.economist.com/the-world-ahead'), Status: { select: { name: 'Approved' } }, 'Ready to Post': { checkbox: true },
    'Verification Status': { select: { name: 'Verified' } }, 'Publish At': { date: { start: '2026-11-19' } }, [FP]: rt(approved.approvalFingerprint) });
  page.properties.Title = rt('A materially revised headline');
  const r = bridge.normalizePage(page, part1.blocks);
  assert.deepEqual(reasons(r), ['approval_fingerprint_mismatch']);
  assertNothingPublic(bridge.buildSnapshot([r], { now: NOW }).articles, [r]);
});

// ---------------- controlled revocation ----------------
test('revision after approval returns to In Review via a controlled update; unrevised articles are untouched', async () => {
  const approved = eligible();
  const revised = eligible(); revised.id = 'revised-id'; revised.slug = 'revised-slug'; revised.title = 'Changed after approval';
  revised.fingerprint = bridge.fingerprint(revised); // approvalFingerprint still the old one
  revised.approvalFingerprint = approved.approvalFingerprint;
  const calls = [];
  const patchPage = async (id, body) => { calls.push({ id, body }); };
  const dry = await bridge.reconcileRevisions([approved, revised], { patchPage });
  assert.equal(calls.length, 0); assert.deepEqual(dry.map((a) => [a.id, a.applied]), [['revised-id', false]]);
  const applied = await bridge.reconcileRevisions([approved, revised], { patchPage, apply: true });
  assert.equal(calls.length, 1); assert.equal(calls[0].id, 'revised-id');
  assert.deepEqual(calls[0].body, { properties: { 'Status': { select: { name: 'In Review' } }, 'Ready to Post': { checkbox: false }, 'Approval Fingerprint': { rich_text: [] } } });
  assert.deepEqual(applied.map((a) => a.applied), [true]);
});
test('In Review / unchecked records with a stale fingerprint are not rewritten', async () => {
  const r = bridge.normalizePage(withFingerprintProp({ ...part1.page, properties: { ...part1.page.properties, [FP]: rt('v1:stale') } }), part1.blocks);
  assert.deepEqual(await bridge.reconcileRevisions([r], { patchPage: async () => { throw new Error('must not write'); }, apply: true }), []);
});
test('approve records the fingerprint only when every other gate passes', async () => {
  const calls = [];
  const patchPage = async (id, body) => calls.push({ id, body });
  const unverified = eligible((p) => { p['Verification Status'] = { select: { name: 'Pending' } }; });
  const out = await bridge.approveRevision(unverified, { patchPage, now: NOW });
  assert.equal(out.approved, false); assert.equal(calls.length, 0);
  const ok = eligible(); ok.approvalFingerprint = '';
  const done = await bridge.approveRevision(ok, { patchPage, now: NOW });
  assert.equal(done.approved, true); assert.deepEqual(Object.keys(calls[0].body.properties), ['Approval Fingerprint']);
});
test('the Notion client refuses writes outside the controlled property set and the Signal Feed data source', async () => {
  assert.throws(() => bridge.createClient({ token: 't', dataSourceId: bridge.SIGNAL_FEED_DATA_SOURCE_ID }), /Signal Feed/);
  assert.throws(() => bridge.createClient({ token: 't', dataSourceId: '35b11486b14580ac891fbd4c62627'.length ? bridge.SIGNAL_FEED_DATA_SOURCE_ID.replace(/-/g, '') : '' }), /Signal Feed/);
  assert.throws(() => bridge.createClient({ token: '', dataSourceId: 'x' }), /NOTION_API_KEY/);
  const sent = [];
  const c = bridge.createClient({ token: 'secret-token', dataSourceId: bridge.DEFAULT_INSIGHTS_DATA_SOURCE_ID, fetchImpl: async (u, i) => { sent.push([u, i]); return { ok: true, status: 200, json: async () => ({}) }; } });
  await assert.rejects(c.patchPage('p', { properties: { 'Homepage Priority': { number: 1 } } }), /controlled property set/);
  await assert.rejects(c.patchPage('p', { properties: { 'Status': { select: { name: 'Published' } } } }), /controlled property set/);
  await assert.rejects(c.patchPage('p', { properties: { 'Status': { select: { name: 'In Review' } }, 'Ready to Post': { checkbox: false }, 'Approval Fingerprint': { rich_text: [] } }, archived: true }), /controlled property set/);
  assert.equal(sent.length, 0);
  await c.patchPage('p', bridge.revokeBody());
  assert.equal(sent.length, 1); assert.match(sent[0][0], /api\.notion\.com\/v1\/pages\/p$/);
});
test('Notion client paginates, fetches bodies only for publishable pages, and never leaks content or tokens in errors', async () => {
  const pages = [withFingerprintProp(part1.page)];
  const pageA = { id: 'a', properties: { ...withFingerprintProp(part1.page).properties, Status: { select: { name: 'Approved' } } } };
  const urls = [];
  const fetchImpl = async (url) => {
    urls.push(url);
    if (url.includes('/query')) return { ok: true, status: 200, json: async () => ({ results: urls.filter((u) => u.includes('/query')).length === 1 ? [pages[0]] : [pageA], has_more: urls.filter((u) => u.includes('/query')).length === 1, next_cursor: 'c2' }) };
    return { ok: true, status: 200, json: async () => ({ results: part1.blocks, has_more: false }) };
  };
  const client = bridge.createClient({ token: 'secret-token', dataSourceId: bridge.DEFAULT_INSIGHTS_DATA_SOURCE_ID, fetchImpl });
  const records = await bridge.loadRecords(client);
  assert.equal(records.length, 2);
  assert.equal(urls.filter((u) => u.includes('/blocks/')).length, 1); // In Review + unchecked page: no body fetch
  const failing = bridge.createClient({ token: 'secret-token', dataSourceId: bridge.DEFAULT_INSIGHTS_DATA_SOURCE_ID, sleep: async () => {},
    fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({ message: part1.NOTES }) }) });
  await assert.rejects(failing.queryAllPages(), (e) => { assert.equal(e.message, 'Notion request failed with status 500'); assert.ok(!e.message.includes('secret-token')); return true; });
});

// ---------------- Editorial Notes isolation ----------------
test('Editorial Notes never enter the snapshot, RSS, sitemap, JSON-LD or CLI output', async () => {
  const SENTINEL = 'SENTINEL-PRIVATE-NOTE-7f3a-do-not-publish';
  const r = eligible((p) => { p['Editorial Notes'] = rt(SENTINEL); });
  const { articles } = bridge.buildSnapshot([r], { now: NOW });
  assert.equal(articles.length, 1);
  const outputs = [bridge.serializeSnapshot(articles), discovery.rss(articles), discovery.rss(articles, 'analysis'), discovery.sitemap(articles), JSON.stringify(discovery.metadata(articles[0]))];
  for (const o of outputs) assert.ok(!o.includes(SENTINEL));
  assert.ok(!Object.keys(articles[0]).some((k) => /note|private|fingerprint/i.test(k)));
  // defence in depth: if notes text were ever copied into a public field the build must throw
  const leaky = eligible((p) => { p['Editorial Notes'] = rt('Unique leaked sentence about the cover.'); p.Author = rt('Unique leaked sentence about the cover.'); });
  assert.throws(() => bridge.buildSnapshot([leaky], { now: NOW }), /Private editorial notes leaked/);
  // CLI prints only ids, slugs and reason codes
  const cli = require('../../insights/build-snapshot.cjs');
  const logs = [];
  const real = require('../../insights/notion-bridge.cjs');
  const orig = real.createClient;
  real.createClient = () => ({ queryAllPages: async () => [part1.page], getBlocks: async () => part1.blocks, patchPage: async () => {} });
  try { await cli.main([], { NOTION_API_KEY: 'secret-token' }, (l) => logs.push(l)); } finally { real.createClient = orig; }
  const text = logs.join('\n');
  assert.ok(!text.includes(part1.NOTES.slice(0, 30)) && !text.includes('secret-token') && !text.includes(part1.page.properties.Title.title[0].plain_text));
  assert.match(text, /status_not_approved/);
});

// ---------------- isolation from Signal Feed / publication ----------------
test('the bridge has no Signal Feed fields, build hooks or workflow coupling', () => {
  const fs = require('node:fs'), path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../insights/notion-bridge.cjs'), 'utf8') + fs.readFileSync(path.join(__dirname, '../../insights/build-snapshot.cjs'), 'utf8');
  for (const forbidden of ["Today's Intelligence", 'Homepage Date', 'Homepage Priority', 'Signal Brief', 'Text 1', 'Synced to Framer', 'BUILD_HOOK', 'netlify', 'publication-state', 'lease'])
    assert.ok(!src.includes(forbidden), forbidden);
});

// ---------------- helper: nothing public anywhere ----------------
function assertNothingPublic(articles, records) {
  assert.equal(articles.length, 0);
  const slug = 'the-world-ahead-2027-converging-risks';
  const json = bridge.serializeSnapshot(articles);
  assert.equal(json.trim(), '[]');
  for (const out of [json, discovery.rss(articles), discovery.rss(articles, 'analysis'), discovery.rss(articles, 'world-ahead'), discovery.sitemap(articles)]) {
    assert.ok(!out.includes(slug)); assert.ok(!out.includes('converging pressures')); assert.ok(!out.includes('PRIVATE'));
  }
  assert.equal(discovery.publishedArticles(articles).length, 0);
  for (const r of records) assert.ok(!json.includes(r.title || '\u0000'));
}
