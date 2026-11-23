import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('V1 archive is native and never sends readers to Framer', () => {
  const page = read('../src/app/old-archives-v1/page.tsx');
  assert.match(page, /getStories\(\)/);
  assert.match(page, /ArchiveExplorer/);
  assert.doesNotMatch(page, /framer\.app|href=.*framer/i);
});

test('V1 records have static detail routes but are not promoted to V2 homepage', () => {
  const routes = read('../src/lib/v2Editorial.ts');
  assert.match(routes, /return stories\.filter\(s => s\.ready/);
  assert.match(routes, /export function publishedStories/);
  const article = read('../src/app/signals/[id]/page.tsx');
  assert.match(article, /HISTORICAL REFERENCE/);
  assert.match(article, /old-archives-v1/);
});

test('Framer is not configured as the deployment target', () => {
  const config = read('../netlify.toml');
  assert.match(config, /publish = "out"/);
});
