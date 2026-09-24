import { parseFeed, FeedParseError, type FeedItem } from './parse.ts';
import { fetchFeedText, FeedFetchError, type FetchOptions } from './fetch.ts';
import { FEED_SOURCES, type FeedSource } from './sources.ts';

export type SourceResult = {
  source: FeedSource;
  /** ok: >=1 valid item; empty: feed was valid but had no usable items; unavailable: fetch/parse failed. */
  status: 'ok' | 'empty' | 'unavailable';
  items: FeedItem[];
  rejectedCount: number;
  /** When this build fetched the feed. Snapshots are not used, so this is always the current build. */
  retrievedAt: string;
  error?: string;
};

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Newest first; equal timestamps fall back to title then canonical URL so output never depends on feed order. */
export function compareItems(a: FeedItem, b: FeedItem): number {
  return cmp(b.publishedAt, a.publishedAt) || cmp(a.title, b.title) || cmp(a.canonicalUrl, b.canonicalUrl);
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
  const base = { source, items: [] as FeedItem[], rejectedCount: 0, retrievedAt: now.toISOString() };
  try {
    const xml = opts.fixtures ? opts.fixtures[source.id] : await fetchFeedText(source, opts);
    if (xml === undefined) return { ...base, status: 'unavailable', error: 'no fixture' };
    const parsed = parseFeed(xml, source, now);
    const items = sortAndDedupe(parsed.items);
    return { ...base, items, rejectedCount: parsed.rejected.length, status: items.length ? 'ok' : 'empty' };
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
