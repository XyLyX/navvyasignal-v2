import fs from 'node:fs';
import path from 'node:path';
import { loadAllFeeds, feedWarning, type SourceResult } from './rss/service.ts';
import { resolveFixtureMode } from './rss/env.ts';
import { enrichOgImages } from './rss/ogImage.ts';
import { NETWORK_PER_SOURCE } from './rss/limits.ts';
import { FEED_SOURCES } from './rss/sources.ts';

// Build-time only (static export). Strategy for unavailable sources: an explicit per-source empty state.
// No last-known snapshot is stored, so every article shown was fetched by the current build.
export type FeedSections = { navyaa: SourceResult; network: SourceResult[]; retrievedAt: string; fixtureMode: boolean };

let cached: Promise<FeedSections> | undefined;

/** Memoised per build process so the homepage and /network share one fetch. */
export function getFeedSections(): Promise<FeedSections> {
  return (cached ??= loadFeedSections());
}

async function loadFeedSections(): Promise<FeedSections> {
  const { useFixtures: fixtureMode, blocked } = resolveFixtureMode(process.env);
  if (blocked) console.warn('[rss] fixture mode was requested on a Netlify build and was ignored; using live feeds');
  const fixtures = fixtureMode
    ? Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/feeds', `${s.id}.xml`), 'utf8')]))
    : undefined;
  const now = new Date();
  let results = await loadAllFeeds({ fixtures, now });
  // Live builds only: look up authentic article OG images for displayed items that have no feed image.
  if (!fixtureMode) results = await enrichOgImages(results, { perSource: NETWORK_PER_SOURCE });
  for (const r of results) { const w = feedWarning(r); if (w) console.warn(w); }
  return {
    navyaa: results.find(r => r.source.group === 'navyaa')!,
    network: results.filter(r => r.source.group === 'network'),
    retrievedAt: now.toISOString(),
    fixtureMode,
  };
}
