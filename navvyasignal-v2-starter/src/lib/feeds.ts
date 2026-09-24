import fs from 'node:fs';
import path from 'node:path';
import { loadAllFeeds, type SourceResult } from './rss/service.ts';
import { FEED_SOURCES } from './rss/sources.ts';

// Build-time only (static export). Strategy for unavailable sources: an explicit per-source empty state.
// No last-known snapshot is stored, so every article shown was fetched by the current build.
export type FeedSections = { navyaa: SourceResult; network: SourceResult[]; retrievedAt: string; fixtureMode: boolean };

function useFixtures(): boolean {
  if (process.env.V2_RSS_FIXTURES === '0') return false; // force live RSS even in CI-stub mode (manual verification)
  return process.env.V2_RSS_FIXTURES === '1' || (process.env.CI === 'true' && process.env.V2_CI_STATIC_FIXTURE === '1');
}

export async function getFeedSections(): Promise<FeedSections> {
  const fixtureMode = useFixtures();
  const fixtures = fixtureMode
    ? Object.fromEntries(FEED_SOURCES.map(s => [s.id, fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/feeds', `${s.id}.xml`), 'utf8')]))
    : undefined;
  const now = new Date();
  const results = await loadAllFeeds({ fixtures, now });
  for (const r of results) if (r.status === 'unavailable') console.warn(`[rss] ${r.source.id} unavailable at build: ${r.error}`);
  return {
    navyaa: results.find(r => r.source.group === 'navyaa')!,
    network: results.filter(r => r.source.group === 'network'),
    retrievedAt: now.toISOString(),
    fixtureMode,
  };
}
