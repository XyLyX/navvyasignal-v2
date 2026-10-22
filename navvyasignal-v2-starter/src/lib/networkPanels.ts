import type { FeedItem } from './rss/parse.ts';
import type { SourceResult } from './rss/service.ts';
import { NETWORK_PER_SOURCE } from './rss/limits.ts';
import { FEED_SOURCES } from './rss/sources.ts';

// Commercial venture links stay separate from RSS-fed publication articles.
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
export type VenturePanel = { kind: 'venture'; id: string; title: string; category: string; description: string; siteUrl: string; mark: string };
export type NetworkPanel = FeedPanel | VenturePanel | JoinPanel;

const VENTURES: VenturePanel[] = [
  { kind:'venture', id:'zarbaft', title:'Zarbaft', category:'Craft & clothing', description:'Explore the Zarbaft edit: regional textiles, craft stories and occasion wear.', siteUrl:'https://zarbaft.art/', mark:'Z' },
  { kind:'venture', id:'ideaiq', title:'IdeaIQ', category:'Ideas & ventures', description:'Explore IdeaIQ, an affiliated venture in the Navvya Network.', siteUrl:'https://ideaiq.io/', mark:'IQ' },
  { kind:'venture', id:'fils-only', title:'FilsOnly', category:'Personal productivity', description:'Discover FilsOnly: email follow-ups today, with Ask Fils and a commitment ledger in development.', siteUrl:'https://filsonly.com/', mark:'F' },
  { kind:'venture', id:'rate-manifest', title:'Rate Manifest', category:'Travel intelligence', description:'Explore destination insights and practical guidance for better travel decisions.', siteUrl:'https://ratemanifest.com/', mark:'RM' },
];
const ORDER = ['zarbaft','ideaiq','fils-only','rate-manifest','om4biz','design-code','zen-insights','zen-portfolio','d6-kitchens'];

export function buildNetworkPanels(results: readonly SourceResult[], perSource: number = NETWORK_PER_SOURCE): NetworkPanel[] {
  const feeds: FeedPanel[] = FEED_SOURCES.filter(s => s.group === 'network').map(source => {
    const result = results.find(r => r.source.id === source.id);
    return {
      kind:'feed', id:source.id, title:`${source.name} ${source.contentType}`, sourceName:source.name,
      contentType:source.contentType, siteUrl:source.siteUrl, status:result?.status ?? 'unavailable',
      items:result?.items.slice(0,perSource) ?? [],
    };
  });
  const panels = new Map<string, NetworkPanel>([...VENTURES,...feeds].map(p => [p.id,p]));
  return [...ORDER.map(id => panels.get(id)!), { kind:'join', id:'join', title:'Join Our Network', href:'/network/join' }];
}
