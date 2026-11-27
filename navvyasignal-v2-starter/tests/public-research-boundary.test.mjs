import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {assertPublicResearchBoundary} from '../scripts/assert-public-research-boundary.mjs';

for (const [name, body, shouldPass] of [
  ['strategic-outlook/index.html', '<h1>Published baseline</h1>', true],
  ['insights/real-estate-intelligence/index.html', '', false],
  ['research/NS-REI-001.pdf', '', false],
  ['sitemap.xml', '<loc>/insights/real-estate-intelligence</loc>', false],
  ['search.json', '{"id":"NS-REI-001"}', false],
  ['feed.xml', '<link>/insights/real-estate-intelligence</link>', false],
  ['index.html', '<meta name="description" content="NS-REI-001">', false],
]) {
  test(name, () => {
    const directory = mkdtempSync(join(tmpdir(), 'public-research-boundary-'));
    try {
      const parent = name.split('/').slice(0, -1).join('/');
      mkdirSync(join(directory, parent), {recursive: true});
      writeFileSync(join(directory, name), body);
      const run = () => assertPublicResearchBoundary(directory, true);
      if (shouldPass) assert.doesNotThrow(run);
      else assert.throws(run, /Public research boundary rejected/);
    } finally {
      rmSync(directory, {recursive: true});
    }
  });
}
