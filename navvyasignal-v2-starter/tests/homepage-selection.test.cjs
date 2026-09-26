const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Transpile the production pure selection module without fetching Notion or using credentials.
const file = path.join(__dirname, '../src/lib/homepageSelection.ts');
const source = fs.readFileSync(file, 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const moduleExports = {};
vm.runInNewContext(js, { exports: moduleExports, Intl, Date, Number }, { filename: 'homepageSelection.js' });
const { dubaiPublicationDate, selectHomepageStories } = moduleExports;
const date = '2026-09-24';
const story = (id, props = {}) => ({ id, title: id, ready: true, today: true, homepageDate: date,
  homepagePriority: null, createdAt: '2026-09-23T10:00:00.000Z', ...props });

test('publication date follows Dubai calendar at UTC midnight boundaries', () => {
  assert.equal(dubaiPublicationDate(new Date('2026-09-23T19:59:00Z')), '2026-09-23');
  assert.equal(dubaiPublicationDate(new Date('2026-09-23T20:00:00Z')), '2026-09-24');
});

test('requires approval, manual checkbox and exact publication date', () => {
  const input = [story('valid'), story('not-approved', { ready: false }),
    story('unchecked', { today: false }), story('yesterday', { homepageDate: '2026-09-23' }),
    story('tomorrow', { homepageDate: '2026-09-25' }), story('undated', { homepageDate: null })];
  assert.deepEqual(Array.from(selectHomepageStories(input, date), s => s.id), ['valid']);
});

test('priority sorts ascending, missing priority last, ties deterministic', () => {
  const input = [story('unset'), story('two', { homepagePriority: 2 }),
    story('one-b', { homepagePriority: 1, createdAt: '2026-09-23T11:00:00Z' }),
    story('one-a', { homepagePriority: 1, createdAt: '2026-09-23T11:00:00Z' }),
    story('invalid', { homepagePriority: -1, createdAt: '2026-09-22T10:00:00Z' })];
  assert.deepEqual(Array.from(selectHomepageStories(input, date), s => s.id),
    ['one-a', 'one-b', 'two', 'unset', 'invalid']);
});

test('limits to seven without a per-desk quota and never resurrects yesterday', () => {
  const input = Array.from({ length: 10 }, (_, i) => story(String(i), { homepagePriority: i + 1, category: 'West Asia Desk' }));
  assert.equal(selectHomepageStories(input, date).length, 7);
  assert.equal(selectHomepageStories(input, '2026-09-25').length, 0);
});

test('missing and invalid priorities use creation date then ID for stable ordering', () => {
  const input = [story('z', { createdAt: '2026-09-23T12:00:00Z' }),
    story('a', { createdAt: '2026-09-23T12:00:00Z' }),
    story('older', { homepagePriority: -1, createdAt: '2026-09-22T12:00:00Z' })];
  assert.deepEqual(Array.from(selectHomepageStories(input, date), s => s.id), ['a', 'z', 'older']);
});
