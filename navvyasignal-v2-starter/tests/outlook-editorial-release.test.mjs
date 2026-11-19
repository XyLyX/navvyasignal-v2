import test from 'node:test';
import assert from 'node:assert/strict';
import {outlookRevision, validateOutlookRelease} from '../scripts/check-outlook-editorial-release.mjs';

const slugs = ['opening', ...Array.from({length:8}, (_, i) => `part-0${i + 1}`), 'closing'];
const read = (_, file) => Buffer.from(file === 'sources.json' ? '["https://example.org/source"]' : file);
const manifest = () => ({sections: slugs.map(slug => ({
 slug, status:'Approved', readyToPost:true, verificationStatus:'Verified',
 approvedRevision:outlookRevision(read, slug), category:'Special Report', editorialScope:'Cross-Desk',
 approvedBy:'Fixture editor', imageRightsReference:'Fixture clearance',
}))});

test('requires approvals for all ten distinct sections', () => {
 assert.deepEqual(validateOutlookRelease(manifest(), read), []);
 const input = manifest();
 input.sections[1] = {slug:'part-01', status:'In Review', readyToPost:false, verificationStatus:'Partially Verified'};
 assert.match(validateOutlookRelease(input, read).join(), /part-01: requires Approved/);
 input.sections[1] = {...manifest().sections[1], verificationStatus:'Partially Verified'};
 assert.match(validateOutlookRelease(input, read).join(), /part-01: requires Approved/);
 input.sections.pop();
 assert.match(validateOutlookRelease(input, read).join(), /closing: missing editorial record/);
});

test('blocks changed title, BLUF, body, sources, or artwork after approval', () => {
 for (const name of ['title.txt', 'bluf.txt', 'body.html', 'sources.json', 'hero.webp']) {
  const changed = (slug, file) => slug === 'part-01' && file === name ? Buffer.from('changed') : read(slug, file);
  assert.match(validateOutlookRelease(manifest(), changed).join(), /part-01: content has changed since approval/);
 }
});

test('fails closed on unknown category, scope, and missing image rights', () => {
 const input = manifest();
 Object.assign(input.sections[0], {category:'Unknown', editorialScope:'Unknown', imageRightsReference:''});
 const errors = validateOutlookRelease(input, read).join();
 assert.match(errors, /unknown category or editorial scope/);
 assert.match(errors, /missing public image rights record/);
});
