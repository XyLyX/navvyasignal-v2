import 'server-only';
export type Insight = { slug:string; title:string; subtitle:string; summary:string; category:'Analysis'|'Explainers'|'The World Ahead'|'Special Reports'; desk:string; author:string; publishedAt:string; modifiedAt:string; body:string[]; sources:{label:string;url:string}[]; heroImage?:string; heroAlt?:string; seoTitle?:string; seoDescription?:string; series?:string; seriesPart?:number };
const origin='https://navvyasignal.com';
const categories=['Analysis','Explainers','The World Ahead','Special Reports'] as const;
export const categorySlugs:Record<string,string>={'analysis':'Analysis','explainers':'Explainers','world-ahead':'The World Ahead','special-reports':'Special Reports'};
const escapeXml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
export const articleUrl=(slug:string)=>`${origin}/insights/${slug}`;
export async function getInsights():Promise<Insight[]> {
 // Approved, versioned snapshot is required. Never read drafts directly from the Signal Feed.
 // An empty index is intentional until the independent Notion publishing bridge is installed.
 const {default: snapshot}=await import('../data/published-insights.json');
 if(!Array.isArray(snapshot))throw new Error('Invalid Insights snapshot');
 const seen=new Set<string>();
 return (snapshot as Insight[]).filter(a=>{
  if(!a || typeof a.slug!=='string'|| !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(a.slug))throw new Error('Invalid published Insights slug');
  if(seen.has(a.slug))throw new Error('Duplicate Insights slug');seen.add(a.slug);
  if(!a.title||!a.summary||!a.author||!a.publishedAt||!a.modifiedAt||!Array.isArray(a.body)||!Array.isArray(a.sources)||!categories.includes(a.category))throw new Error('Invalid Insights article');
  if(!Number.isFinite(Date.parse(a.publishedAt))||!Number.isFinite(Date.parse(a.modifiedAt)))throw new Error('Invalid article timestamp');
  if(a.sources.some(s=>!s.label||!/^https:\/\//.test(s.url)))throw new Error('Invalid source URL');
  if(a.heroImage && (!/^https:\/\//.test(a.heroImage)||!a.heroAlt))throw new Error('Invalid hero image');
  return Date.parse(a.publishedAt)<=Date.now();
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
}
export function makeRss(articles:Insight[],category?:string) {
 if(category && !categorySlugs[category])throw new Error('Invalid RSS category');
 const path=`/insights/${category?category+'/':''}rss.xml`;
 const items=articles.filter(a=>!category||a.category===categorySlugs[category]).slice(0,50);
 const updated=items.reduce((m,a)=>Math.max(m,Date.parse(a.modifiedAt)),0);
 return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>NavvyaSignal Insights &amp; Analysis</title><link>${origin}/insights</link><description>Original geopolitical and market analysis</description><language>en</language><atom:link href="${origin}${path}" rel="self" type="application/rss+xml"/>${updated?`<lastBuildDate>${new Date(updated).toUTCString()}</lastBuildDate>`:''}${items.map(a=>`<item><title>${escapeXml(a.title)}</title><link>${articleUrl(a.slug)}</link><guid isPermaLink="true">${articleUrl(a.slug)}</guid><description>${escapeXml(a.summary)}</description><pubDate>${new Date(a.publishedAt).toUTCString()}</pubDate><dc:creator>${escapeXml(a.author)}</dc:creator><category>${escapeXml(a.category)}</category></item>`).join('')}</channel></rss>`;
}
