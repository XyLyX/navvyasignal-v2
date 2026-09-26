import { parseFeed, FeedParseError, type FeedItem } from './parse.ts';
import { fetchFeedText, FeedFetchError, type FetchOptions } from './fetch.ts';
import { FEED_SOURCES, type FeedSource } from './sources.ts';

export type SourceResult = {
  source: FeedSource;
  /**
   * ok: >=1 valid item; empty: feed is valid and lists no entries (or all were duplicates of earlier sources);
   * all-rejected: entries exist but every one failed validation; unavailable: fetch/parse failed.
   */
  status: 'ok' | 'empty' | 'all-rejected' | 'unavailable';
  items: FeedItem[];
  rejectedCount: number;
  /** Rejection counts by fixed reason code only; never article content. */
  rejectedReasons: Record<string, number>;
  /** Entries present in the feed before validation. */
  totalEntries: number;
  /** When this build fetched the feed. Snapshots are not used, so this is always the current build. */
  retrievedAt: string;
  error?: string;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Newest first. Equal timestamps keep the publisher's own feed order (matching the publication's index page), then
 * canonical URL, so a given feed always yields the same result whatever order the items are passed in.
 */
export function compareItems(a: FeedItem, b: FeedItem): number {
  return cmp(b.publishedAt, a.publishedAt) || a.feedIndex - b.feedIndex || cmp(a.canonicalUrl, b.canonicalUrl);
}

/** Deterministically sort and drop repeated canonical URLs (first after sorting wins). */
export function sortAndDedupe(items: readonly FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  const out: FeedItem[] = [];
  for (const it of [...items].sort(compareItems)) {
    if (seen.has(it.canonicalUrl)) continue;
    seen.add(it.canonicalUrl);
    out.push(it);
  }
  return out;
}

export type LoadOptions = FetchOptions & {
  now?: Date;
  /** Pre-supplied XML by source id; used for offline CI builds. Skips the network entirely. */
  fixtures?: Record<string, string>;
  sources?: readonly FeedSource[];
};

export async function loadSource(source: FeedSource, opts: LoadOptions = {}): Promise<SourceResult> {
  const now = opts.now ?? new Date();
  const base = { source, items: [] as FeedItem[], rejectedCount: 0, rejectedReasons: {} as Record<string, number>, totalEntries: 0, retrievedAt: now.toISOString() };
  try {
    const xml = opts.fixtures ? opts.fixtures[source.id] : await fetchFeedText(source, opts);
    if (xml === undefined) return { ...base, status: 'unavailable', error: 'no fixture' };
    const parsed = parseFeed(xml, source, now);
    const items = sortAndDedupe(parsed.items);
    const rejectedReasons: Record<string, number> = {};
    for (const r of parsed.rejected) rejectedReasons[r.reason] = (rejectedReasons[r.reason] ?? 0) + 1;
    const status = items.length ? 'ok' : parsed.totalItems > 0 ? 'all-rejected' : 'empty';
    return { ...base, items, rejectedCount: parsed.rejected.length, rejectedReasons, totalEntries: parsed.totalItems, status };
  } catch (e) {
    const code = e instanceof FeedFetchError || e instanceof FeedParseError ? e.code : 'unexpected';
    return { ...base, status: 'unavailable', error: `${code}: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Load every allowlisted source independently; one failure never affects the others and this never throws. */
export async function loadAllFeeds(opts: LoadOptions = {}): Promise<SourceResult[]> {
  const sources = opts.sources ?? FEED_SOURCES;
  const results = await Promise.all(sources.map(s => loadSource(s, opts)));
  // A canonical URL may appear once across the whole site; earlier allowlist entries win.
  const seen = new Set<string>();
  return results.map(r => {
    const items = r.items.filter(i => !seen.has(i.canonicalUrl) && (seen.add(i.canonicalUrl), true));
    return { ...r, items, status: r.status === 'ok' && !items.length ? 'empty' : r.status };
  });
}

/**
 * Build-log warning for a source that needs attention, or null. The all-rejected warning contains only the source
 * id, counts and fixed reason codes; item text (titles, links, excerpts) is never logged.
 */
export function feedWarning(r: SourceResult): string | null {
  if (r.status === 'all-rejected') {
    const reasons = Object.entries(r.rejectedReasons).sort(([a], [b]) => cmp(a, b)).map(([k, n]) => `${k}=${n}`).join(', ');
    return `[rss] ${r.source.id}: feed has ${r.totalEntries} entries but all ${r.rejectedCount} were rejected (${reasons}); showing empty state`;
  }
  if (r.status === 'unavailable') return `[rss] ${r.source.id} unavailable at build: ${r.error}`;
  return null;
}
