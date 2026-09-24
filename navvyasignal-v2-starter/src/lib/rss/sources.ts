// Allowlist of the only feeds the build-time importer may fetch. The importer looks sources up by id;
// no caller-supplied URL is ever fetched.
export type FeedSource = {
  id: string;
  name: string;
  group: 'navyaa' | 'network';
  /** Label shown on cards so readers know what kind of publication an item comes from. */
  contentType: string;
  feedUrl: string;
  siteUrl: string;
  /** Hosts permitted for redirects, article links and article images. */
  allowedHosts: readonly string[];
};

export const FEED_SOURCES: readonly FeedSource[] = Object.freeze([
  { id: 'navyaa', name: 'Navyaa', group: 'navyaa', contentType: 'Essays', feedUrl: 'https://navyaa.blog/feed.xml', siteUrl: 'https://navyaa.blog/', allowedHosts: ['navyaa.blog', 'www.navyaa.blog'] },
  { id: 'om4biz', name: 'OM4BIZ', group: 'network', contentType: 'Insights', feedUrl: 'https://om4biz.com/feed.xml', siteUrl: 'https://om4biz.com/', allowedHosts: ['om4biz.com', 'www.om4biz.com'] },
  { id: 'd6-kitchens', name: 'D6 Kitchens', group: 'network', contentType: 'Insights', feedUrl: 'https://d6kitchens.com/feed.xml', siteUrl: 'https://d6kitchens.com/', allowedHosts: ['d6kitchens.com', 'www.d6kitchens.com'] },
  { id: 'zen-insights', name: 'Zen Homes', group: 'network', contentType: 'Insights', feedUrl: 'https://zenhomesglobal.com/insights/feed.xml', siteUrl: 'https://zenhomesglobal.com/insights/', allowedHosts: ['zenhomesglobal.com', 'www.zenhomesglobal.com'] },
  { id: 'zen-portfolio', name: 'Zen Homes', group: 'network', contentType: 'Portfolio', feedUrl: 'https://zenhomesglobal.com/portfolio/feed.xml', siteUrl: 'https://zenhomesglobal.com/portfolio/', allowedHosts: ['zenhomesglobal.com', 'www.zenhomesglobal.com'] },
  { id: 'design-code', name: 'Design Code Studios', group: 'network', contentType: 'Insights', feedUrl: 'https://designcode.ae/insights-feed.xml', siteUrl: 'https://designcode.ae/insights', allowedHosts: ['designcode.ae', 'www.designcode.ae'] },
]);

export function getSource(id: string): FeedSource | undefined {
  return FEED_SOURCES.find(s => s.id === id);
}
