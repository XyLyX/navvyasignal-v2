const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./helpers/loadTs.cjs');

const { selectHomepageEdition, selectHomepageStories } = load('homepageSelection');
const { publishedStories, latestOfType, v2ArticleRoutes, publicationStartDate, exceptionStoryIds } = load('v2Editorial');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const story = (id, props = {}) => ({ id, title: id, brief: 'b', body: '', category: 'West Asia Desk', contentType: 'Signal',
  ready: true, today: false, homepageDate: null, homepagePriority: null, watchlist: false, watchStatus: '',
  nextReview: null, coverageThemes: [], createdAt: '2026-09-26T08:00:00.000Z', ...props });
const pick = (id, date, priority, props = {}) => story(id, { today: true, homepageDate: date, homepagePriority: priority, ...props });
const ids = list => Array.from(list, s => s.id);
const ENV = {};   // default publication start = 2026-09-25

// ---------------- rolling edition ----------------
test('rolling edition: shows the newest Homepage Date, ordered by priority, labelled current', () => {
  const all = [pick('b', '2026-09-26', 2), pick('a', '2026-09-26', 1), pick('old', '2026-09-25', 1)];
  const e = selectHomepageEdition(all, '2026-09-26');
  assert.equal(e.date, '2026-09-26'); assert.equal(e.isCurrent, true);
  assert.deepEqual(ids(e.stories), ['a', 'b']);
});

test('rolling edition: falls back to the latest completed edition with no hard expiry', () => {
  const all = [pick('a', '2026-09-26', 1), pick('b', '2026-09-26', 2)];
  for (const today of ['2026-09-27', '2026-09-30', '2026-12-01']) {   // automation delayed by days
    const e = selectHomepageEdition(all, today);
    assert.equal(e.date, '2026-09-26'); assert.equal(e.isCurrent, false);
    assert.deepEqual(ids(e.stories), ['a', 'b']);
  }
});

test('rolling edition: never combines dates, even when the newest edition is only partially populated', () => {
  const all = [pick('full1', '2026-09-26', 1), pick('full2', '2026-09-26', 2), pick('full3', '2026-09-26', 3),
    pick('new-partial', '2026-09-27', 1)];
  const e = selectHomepageEdition(all, '2026-09-27');
  assert.equal(e.date, '2026-09-27');
  assert.deepEqual(ids(e.stories), ['new-partial']);           // not padded from 26 Sep
  assert.equal(e.isCurrent, true);
});

test('rolling edition: no edition exists', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(selectHomepageEdition([], '2026-09-27'))), { date: null, stories: [], isCurrent: false });
  const none = [story('untagged', { homepageDate: '2026-09-26' }), story('flagless-date'), pick('unapproved', '2026-09-26', 1, { ready: false })];
  assert.equal(selectHomepageEdition(none, '2026-09-27').date, null);
});

test('rolling edition: future-dated, invalid-dated and unapproved records never define the edition', () => {
  const all = [pick('ok', '2026-09-26', 1), pick('future', '2026-09-29', 1), pick('bad', '26/09/2026', 1),
    pick('unapproved', '2026-09-27', 1, { ready: false }), pick('unflagged', '2026-09-27', 1, { today: false })];
  const e = selectHomepageEdition(all, '2026-09-27');
  assert.equal(e.date, '2026-09-26'); assert.deepEqual(ids(e.stories), ['ok']);
});

test('rolling edition: seven-story limit within the edition, manual and automatic alike, no desk quota', () => {
  const all = Array.from({ length: 10 }, (_, i) => pick(`s${i}`, '2026-09-26', i + 1));
  assert.deepEqual(ids(selectHomepageEdition(all, '2026-09-26').stories), ['s0', 's1', 's2', 's3', 's4', 's5', 's6']);
  assert.equal(selectHomepageEdition(all, '2026-09-26', 7).stories.length, 7);
});

test('rolling edition: priority ordering with unset/invalid last and deterministic ties', () => {
  const all = [pick('unset', '2026-09-26', null), pick('two', '2026-09-26', 2), pick('neg', '2026-09-26', -1),
    pick('one-b', '2026-09-26', 1, { createdAt: '2026-09-26T11:00:00Z' }), pick('one-a', '2026-09-26', 1, { createdAt: '2026-09-26T11:00:00Z' })];
  assert.deepEqual(ids(selectHomepageEdition(all, '2026-09-26').stories), ['one-a', 'one-b', 'two', 'neg', 'unset']);   // invalid == unset; then newest, then id
});

test('exact-date selector remains available and unchanged', () => {
  assert.deepEqual(ids(selectHomepageStories([pick('a', '2026-09-26', 1), pick('b', '2026-09-25', 1)], '2026-09-26')), ['a']);
});

// ---------------- publication independent of homepage selection ----------------
test('every approved V2-era story is published with or without homepage metadata', () => {
  const all = [story('plain'), pick('selected', '2026-09-26', 1), story('unapproved', { ready: false }),
    story('dated-not-flagged', { homepageDate: '2026-09-26' })];
  assert.deepEqual(new Set(ids(publishedStories(all, ENV))), new Set(['plain', 'selected', 'dated-not-flagged']));
});

test('no allowlist is required: an arbitrary new approved article publishes with an empty exception list', () => {
  const s = story('3e711486-b145-8000-0000-000000000001');
  assert.deepEqual(ids(publishedStories([s], { V2_CURRENT_STORY_IDS: '' })), [s.id]);
  assert.deepEqual(ids(publishedStories([s], { V2_CURRENT_STORY_IDS: 'some-other-id' })), [s.id]);   // exceptions never restrict
});

test('historical Framer-era records stay out unless dated for V2 or explicitly excepted', () => {
  const old = story('old', { createdAt: '2026-08-01T10:00:00Z' });
  assert.deepEqual(ids(publishedStories([old], ENV)), []);
  assert.deepEqual(ids(publishedStories([story('old-but-homepage-dated', { createdAt: '2026-08-01T10:00:00Z', homepageDate: '2026-09-26' })], ENV)), ['old-but-homepage-dated']);
  assert.deepEqual(ids(publishedStories([old], { V2_CURRENT_STORY_IDS: ' OLD ' })), ['old']);         // documented exception, case-insensitive
  assert.deepEqual(ids(publishedStories([old], { V2_PUBLICATION_START: '1970-01-01' })), ['old']);    // guard can be disabled deliberately
  assert.equal(publicationStartDate({ V2_PUBLICATION_START: 'garbage' }), '2026-09-25');
  assert.deepEqual([...exceptionStoryIds({ V2_CURRENT_STORY_IDS: 'A, b ,,' })], ['a', 'b']);
});

test('publication start uses the Dubai calendar day of creation', () => {
  assert.equal(publishedStories([story('late-utc', { createdAt: '2026-09-24T20:30:00Z' })], ENV).length, 1);   // 00:30 on 25 Sep in Dubai
  assert.equal(publishedStories([story('before', { createdAt: '2026-09-24T19:30:00Z' })], ENV).length, 0);
  assert.equal(publishedStories([story('bad-date', { createdAt: 'not a date' })], ENV).length, 0);            // no crash
});

test('published stories are unique and newest first', () => {
  const out = publishedStories([story('a', { createdAt: '2026-09-26T01:00:00Z' }), story('b', { createdAt: '2026-09-26T09:00:00Z' }), story('a')], ENV);
  assert.deepEqual(ids(out), ['b', 'a']);
});

// ---------------- routes ----------------
test('individual routes exist for every published story, approved watchlist stories and nothing else', () => {
  const all = [story('plain'), pick('selected', '2026-09-26', 1), story('unapproved', { ready: false }),
    story('old-watch', { createdAt: '2026-01-01T00:00:00Z', watchlist: true, watchStatus: 'Active' }),
    story('old-plain', { createdAt: '2026-01-01T00:00:00Z' })];
  assert.deepEqual(new Set(ids(v2ArticleRoutes(all, ENV))), new Set(['plain', 'selected', 'old-watch']));
});

test('CI fixture route is only produced under the explicit CI flags', () => {
  const fx = story('ci-static-fixture', { createdAt: '2026-01-01T00:00:00Z' });
  assert.equal(v2ArticleRoutes([fx], ENV).length, 0);
  assert.equal(v2ArticleRoutes([fx], { CI: 'true', V2_CI_STATIC_FIXTURE: '1' }).length, 1);
});

test('watchlist exception grants a route only: every /watchlist card has a working link, nothing else is widened', () => {
  const old = { createdAt: '2026-01-01T00:00:00Z', watchlist: true };
  const all = [story('w-active', { ...old, watchStatus: 'Active' }), story('w-resolved', { ...old, watchStatus: 'Resolved' }),
    story('w-abandoned', { ...old, watchStatus: 'Abandoned' }), story('w-unapproved', { ...old, ready: false }), story('plain-old', { createdAt: '2026-01-01T00:00:00Z' })];
  const routes = new Set(ids(v2ArticleRoutes(all, ENV)));
  for (const w of all.filter(s => s.ready && s.watchlist)) assert.ok(routes.has(w.id), `${w.id} is linked from /watchlist so it needs a route`);
  assert.ok(!routes.has('w-unapproved') && !routes.has('plain-old'));
  // ...but none of them enters desks, the archive, the homepage edition or the panels.
  const pub = publishedStories(all, ENV);
  assert.deepEqual(ids(pub), []);
  assert.equal(selectHomepageEdition(pub, '2026-09-27').date, null);
  assert.equal(latestOfType(pub, 'Cross-Desk'), undefined);
  // a watchlist story that IS V2-era is published normally
  assert.deepEqual(ids(publishedStories([story('w-new', { watchlist: true, watchStatus: 'Active' })], ENV)), ['w-new']);
});

// ---------------- editorial panels ----------------
test('Cross-Desk, Briefing and Long Read panels use the latest approved item of each type, independent of the homepage', () => {
  const all = [story('cd-old', { contentType: 'Cross-Desk', createdAt: '2026-09-25T10:00:00Z' }),
    story('cd-new', { contentType: 'Cross-Desk', createdAt: '2026-09-26T10:00:00Z' }),
    story('br', { contentType: 'Briefing' }), story('lr', { contentType: 'Long Read' }),
    story('lr-unapproved', { contentType: 'Long Read', ready: false, createdAt: '2026-09-26T23:00:00Z' }),
    pick('homepage-only', '2026-09-26', 1)];
  const pub = publishedStories(all, ENV);
  assert.equal(latestOfType(pub, 'Cross-Desk').id, 'cd-new');
  assert.equal(latestOfType(pub, 'Briefing').id, 'br');
  assert.equal(latestOfType(pub, 'Long Read').id, 'lr');
  assert.equal(latestOfType([], 'Briefing'), undefined);
  assert.equal(selectHomepageEdition(pub, '2026-09-26').stories.some(s => s.contentType !== 'Signal'), false);   // panels never depend on the edition
});

// ---------------- wiring (source-level) ----------------
test('pages use publication for desks/signals/routes and the rolling edition only for the homepage', () => {
  for (const f of ['src/app/page.tsx', 'src/app/desks/[slug]/page.tsx', 'src/app/signals/page.tsx', 'src/app/signals/[id]/page.tsx', 'src/lib/v2Editorial.ts'])
    assert.doesNotMatch(read(f), /approvedV2Ids|currentV2Stories|V2_RELEASE_STORY_IDS/, `${f} no longer depends on the allowlist`);
  assert.match(read('src/app/page.tsx'), /<FreshIntelligence stories=\{fresh\}/);
  assert.doesNotMatch(read('src/app/page.tsx'), /selectHomepageStories\(.*8\)/);
  assert.match(read('src/app/page.tsx'), /latestOfType\(fresh, 'Cross-Desk'\)/);
  assert.doesNotMatch(read('src/app/page.tsx'), /Latest edition|homepage\.isCurrent/);
  assert.match(read('src/app/desks/[slug]/page.tsx'), /publishedStories\(await getStories\(\)\)/);
  assert.match(read('src/app/signals/page.tsx'), /publishedStories\(await getStories\(\)\)/);
  const detail = read('src/app/signals/[id]/page.tsx');
  assert.match(detail, /generateStaticParams[\s\S]*v2ArticleRoutes\(stories\)/);
  assert.match(detail, /const visible = v2ArticleRoutes\(stories\)/);
  assert.match(detail, /dynamicParams = false/);
});
