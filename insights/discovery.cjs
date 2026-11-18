// Framework-independent Insights publication discovery primitives.
// Integrate only with an approved published snapshot; never query draft Notion pages here.
const ORIGIN = 'https://navvyasignal.com';
const CATEGORIES = Object.freeze({
  analysis: 'Analysis', explainers: 'Explainers',
  'world-ahead': 'The World Ahead', 'special-reports': 'Special Reports'
});
const xml = (v) => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const validDate = (v) => { const d = new Date(v); if (!Number.isFinite(d.getTime())) throw new Error('Invalid article date'); return d; };
const absoluteUrl = (slug) => {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error('Invalid slug');
  return `${ORIGIN}/insights/${slug}`;
};
function publishedArticles(records) {
  if (!Array.isArray(records)) throw new TypeError('Expected published snapshot array');
  const seen = new Set();
  return records.filter(a => {
    if (a.status !== 'Published' || a.public !== true) return false;
    if (!a.slug || !a.title || !a.summary || !a.publishedAt || !a.modifiedAt) throw new Error('Incomplete published article');
    absoluteUrl(a.slug);
    if (seen.has(a.slug)) throw new Error('Duplicate published slug');
    seen.add(a.slug);
    if (!Object.values(CATEGORIES).includes(a.category)) throw new Error('Unknown article category');
    validDate(a.publishedAt); validDate(a.modifiedAt);
    if (validDate(a.publishedAt) > new Date()) return false;
    return true;
  }).sort((a,b)=>validDate(b.publishedAt)-validDate(a.publishedAt));
}
function metadata(article) {
  const url = absoluteUrl(article.slug);
  const title = article.seoTitle || article.title;
  const description = article.seoDescription || article.summary;
  const image = article.heroImage || null;
  if (image && (!/^https:\/\//.test(image) || !article.heroAlt)) throw new Error('Hero image requires HTTPS and alt text');
  return {
    title, description, canonical: url,
    openGraph: { type:'article', title, description, url, ...(image ? {images:[{url:image,alt:article.heroAlt}]} : {}), publishedTime:validDate(article.publishedAt).toISOString(), modifiedTime:validDate(article.modifiedAt).toISOString() },
    twitter: {card:image ? 'summary_large_image' : 'summary',title,description},
    jsonLd: {'@context':'https://schema.org','@type':article.reportingType === 'news' ? 'NewsArticle' : 'Article',
      headline:article.title, description, mainEntityOfPage:url, datePublished:validDate(article.publishedAt).toISOString(),
      dateModified:validDate(article.modifiedAt).toISOString(), inLanguage:'en',
      articleSection:article.category, publisher:{'@type':'Organization',name:'NavvyaSignal',url:ORIGIN},
      ...(article.author ? {author:{'@type':'Person',name:article.author}} : {}),
      ...(image ? {image} : {})}
  };
}
function rss(records, categorySlug) {
  if (categorySlug && !CATEGORIES[categorySlug]) throw new Error('Unknown category feed');
  const feedUrl = `${ORIGIN}/insights/${categorySlug ? categorySlug+'/' : ''}rss.xml`;
  const articles = publishedArticles(records).filter(a=>!categorySlug || a.category===CATEGORIES[categorySlug]).slice(0,50);
  const lastBuild = articles.reduce((max,a)=>Math.max(max,validDate(a.modifiedAt).getTime()),0);
  const items = articles.map(a=>`<item><title>${xml(a.title)}</title><link>${xml(absoluteUrl(a.slug))}</link><guid isPermaLink="true">${xml(absoluteUrl(a.slug))}</guid><description>${xml(a.summary)}</description><pubDate>${validDate(a.publishedAt).toUTCString()}</pubDate><category>${xml(a.category)}</category>${a.author ? `<dc:creator>${xml(a.author)}</dc:creator>` : ''}</item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>${xml('NavvyaSignal Insights & Analysis'+(categorySlug?' — '+CATEGORIES[categorySlug]:''))}</title><link>${ORIGIN}/insights</link><description>Independent geopolitical and market analysis</description><language>en</language><atom:link href="${xml(feedUrl)}" rel="self" type="application/rss+xml"/>${lastBuild ? `<lastBuildDate>${new Date(lastBuild).toUTCString()}</lastBuildDate>` : ''}${items}</channel></rss>`;
}
function sitemap(records) {
  const pages = publishedArticles(records).map(a=>`<url><loc>${xml(absoluteUrl(a.slug))}</loc><lastmod>${validDate(a.modifiedAt).toISOString()}</lastmod></url>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${ORIGIN}/insights</loc></url>${pages}</urlset>`;
}
module.exports={ORIGIN,CATEGORIES,absoluteUrl,publishedArticles,metadata,rss,sitemap};
