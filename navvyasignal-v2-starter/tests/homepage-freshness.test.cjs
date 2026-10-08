const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../src/lib/homepageFreshness.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, { exports: exportsObject, Date, Number, Math });
const { selectFreshIntelligence, isHomepageFresh } = exportsObject;
const now = Date.parse('2026-10-08T22:50:00Z');
const story = (id, age, extra = {}) => ({ id, ready: true, contentType: 'Signal', createdAt: new Date(now-age*3600000).toISOString(), ...extra });
const ids = rows => Array.from(rows, r => r.id);
test('new approvals appear without the nightly selection, and beat old priorities', () => {
  assert.deepEqual(ids(selectFreshIntelligence([story('older-curated', 20, { today: true, homepagePriority: 1 }), story('new-approved', 1, { today: false, homepageDate: null })], now)), ['new-approved', 'older-curated']);
});
test('24-hour boundary expires even with renewed homepage metadata', () => {
  const rows = [story('stale',24,{ today:true, homepageDate:'2026-10-09' }),story('fresh',23.99),story('future',-1),story('invalid',1,{createdAt:'invalid'}),story('private',1,{ready:false})];
  assert.deepEqual(ids(selectFreshIntelligence(rows,now)),['fresh']);
  assert.equal(isHomepageFresh(story('expires',23.99),now+60000),false);
});
test('never pads an empty or short list with old reports; cap seven and exclude other formats', () => {
  assert.equal(selectFreshIntelligence([story('old',48)],now).length,0);
  assert.equal(selectFreshIntelligence([story('only',1),story('long',1,{contentType:'Long Read'})],now).length,1);
  assert.equal(selectFreshIntelligence(Array.from({length:12},(_,i)=>story(String(i),i)),now).length,7);
});
