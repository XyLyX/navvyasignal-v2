import fs from 'node:fs';
import path from 'node:path';
import { loadAllFeeds, feedWarning, type SourceResult } from './rss/service.ts';
import { resolveFixtureMode } from './rss/env.ts';
import { FEED_SOURCES } from './rss/sources.ts';

// Build-time only (static export). Strategy for unavailable sources: an explicit per-source empty state.
// No last-known snapshot is stored, so every article shown was fetched by the current build.
export type FeedSections = { navyaa: SourceResult; network: SourceResult[]; retrievedAt: string; fixtureMode: boolean };

export async function getFeedSections(): Promise<FeedSections> {
  const { useFixtures: fixtureMode, blocked } = resolveFixtureMode(process.env);
  if (blocked) console.warn('[rss] fixture mode was requested on a Netlify build and was ignored; using live feeds');
  const fixtures = fixtureMode
    ? Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/feeds', `${s.id}.xml`), 'utf8')]))
    : undefined;
  const now = new Date();
  const results = await loadAllFeeds({ fixtures, now });
  for (const r of results) { const w = feedWarning(r); if (w) console.warn(w); }
  return {
    navyaa: results.find(r => r.source.group === 'navyaa')!,
    network: results.filter(r => r.source.group === 'network'),
    retrievedAt: now.toISOString(),
    fixtureMode,
  };
}
