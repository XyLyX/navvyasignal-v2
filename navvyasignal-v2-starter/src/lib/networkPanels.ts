import type { FeedItem } from './rss/parse.ts';
import type { SourceResult } from './rss/service.ts';
import { NETWORK_PER_SOURCE } from './rss/limits.ts';

// Pure model for the six equal /network panels: five feed panels in allowlist order, then Join Our Network.
export type FeedPanel = {
  kind: 'feed';
  id: string;
  /** e.g. "OM4BIZ Insights" */
  title: string;
  sourceName: string;
  contentType: string;
  siteUrl: string;
  status: SourceResult['status'];
  items: FeedItem[];
};
export type JoinPanel = { kind: 'join'; id: 'join'; title: string; href: string };
export type NetworkPanel = FeedPanel | JoinPanel;

export function buildNetworkPanels(results: readonly SourceResult[], perSource: number = NETWORK_PER_SOURCE): NetworkPanel[] {
  const feeds: FeedPanel[] = results
    .filter(r => r.source.group === 'network')
    .map(r => ({
      kind: 'feed' as const, id: r.source.id, title: `${r.source.name} ${r.source.contentType}`, sourceName: r.source.name,
      contentType: r.source.contentType, siteUrl: r.source.siteUrl, status: r.status, items: r.items.slice(0, perSource),
    }));
  return [...feeds, { kind: 'join', id: 'join', title: 'Join Our Network', href: '/network/join' }];
}
