import type { FeedSections } from '../feeds';
import type { SourceResult } from './service';

export const FEED_REFRESH_MS = 15 * 60 * 1000;

/** A failing source preserves its last visible results; a valid empty feed clears them. */
export function mergeLiveFeeds(previous: FeedSections, next: FeedSections): FeedSections {
  const preserve = (old: SourceResult | undefined, fresh: SourceResult) => {
    if (old && (fresh.status === 'unavailable' || fresh.status === 'all-rejected')) return old;
    // Preserve verified build-time OG artwork only for the very same article.
    return { ...fresh, items: fresh.items.map(item => {
      const prior = old?.items.find(x => x.canonicalUrl === item.canonicalUrl);
      return !item.imageUrl && prior?.imageUrl ? { ...item, imageUrl: prior.imageUrl, imageSource: prior.imageSource } : item;
    }) };
  };
  return { ...next, navyaa: preserve(previous.navyaa, next.navyaa),
    network: next.network.map(fresh => preserve(previous.network.find(old => old.source.id === fresh.source.id), fresh)) };
}
