import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFeedHandler } from '../netlify/functions/publication-feeds.ts';
import { loadAllFeeds } from '../src/lib/rss/service.ts';
import { FEED_SOURCES } from '../src/lib/rss/sources.ts';
import { mergeLiveFeeds } from '../src/lib/rss/live.ts';
import type { FeedSections } from '../src/lib/feeds';

const fixtures = Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(new URL(`./fixtures/feeds/${s.id}.xml`, import.meta.url), 'utf8')]));
const now = new Date('2026-09-30T12:00:00Z');
const load = () => loadAllFeeds({ fixtures, now });
const sections = async (): Promise<FeedSections> => {
  const results = await load();
  return { navyaa: results[0], network: results.slice(1), retrievedAt: now.toISOString(), fixtureMode: false };
};

test('live endpoint returns all six feeds with shared cache headers and display caps', async () => {
  const response = await createFeedHandler(load)(new Request('https://example.com/api/publication-feeds'));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.fixtureMode, false);
  assert.equal(data.network.length, 5);
  assert.equal(data.navyaa.source.id, 'navyaa');
  assert.ok(data.navyaa.items.length <= 3);
  assert.ok(data.network.every((r: {items: unknown[]}) => r.items.length <= 2));
  assert.match(response.headers.get('Netlify-CDN-Cache-Control')!, /durable, max-age=900/);
});

test('requests cannot select an arbitrary URL or trigger writes', async () => {
  let calls = 0;
  const handler = createFeedHandler(async () => { calls++; return load(); });
  assert.equal((await handler(new Request('https://example.com/api/publication-feeds?url=https://other.example'))).status, 400);
  assert.equal((await handler(new Request('https://example.com/api/publication-feeds', { method: 'POST' }))).status, 405);
  assert.equal(calls, 0);
});

test('one failing source leaves other sources live and uses a short retry cache', async () => {
  const handler = createFeedHandler(async () => (await load()).map((r, i) => i === 0 ? { ...r, items: [], status: 'unavailable' as const } : r));
  const response = await handler(new Request('https://example.com/api/publication-feeds'));
  const data = await response.json();
  assert.ok(data.network.every((r: {status: string}) => r.status === 'ok'));
  assert.match(response.headers.get('Netlify-CDN-Cache-Control')!, /max-age=60/);
  const prior = await sections();
  const merged = mergeLiveFeeds(prior, data);
  assert.deepEqual(merged.navyaa.items, prior.navyaa.items);
});

test('valid empty feeds clear old articles; refreshed articles replace the build snapshot', async () => {
  const prior = await sections();
  const next = await sections();
  next.navyaa = { ...next.navyaa, status: 'empty', items: [] };
  next.network[0].items[0] = { ...next.network[0].items[0], title: 'Newly published title' };
  const merged = mergeLiveFeeds(prior, next);
  assert.equal(merged.navyaa.items.length, 0);
  assert.equal(merged.network[0].items[0].title, 'Newly published title');
});
