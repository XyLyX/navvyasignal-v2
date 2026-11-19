import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {validateOutlookRelease} from '../../scripts/check-outlook-editorial-release.mjs';
import {outlookSections} from './strategicOutlook';
import {outlookOrigin, outlookPath, outlookSeriesTitle, outlookDescription} from './strategicOutlookSeo';

type PublishedSection = {
 slug: string; title: string; summary: string; body: string; sources: string[];
 imageAlt: string; hero: Buffer; publishedAt: string;
};

export function getPublishedOutlook(): PublishedSection[] {
 const directory = process.env.STRATEGIC_OUTLOOK_APPROVED_EDITION;
 if (process.env.NEXT_PUBLIC_V2_PRODUCTION !== 'true' || !directory) return [];
 const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
 const files = new Map<string, Buffer>();
 const read = (slug: string, file: string) => {
  const path = join(directory, slug, file);
  if (!files.has(path)) files.set(path, readFileSync(path));
  return files.get(path)!;
 };
 const errors = validateOutlookRelease(manifest, read);
 const publishedAt = manifest.publishedAt;
 if (typeof publishedAt !== 'string' || !Number.isFinite(Date.parse(publishedAt)) || Date.parse(publishedAt) > Date.now()) {
  errors.push('A valid publication date at or before the build time is required');
 }
 if (errors.length) throw new Error('Outlook publication blocked: ' + errors.join('; '));
 const publicationDate = new Date(publishedAt).toISOString();
 return outlookSections.map(section => {
  const {slug} = section;
  const hero = read(slug, 'hero.webp');
  const isEditionGlobe = hero.equals(readFileSync(join(process.cwd(), 'scripts/outlook-artwork/strategic-outlook-cover.webp')));
  if (slug === 'opening' && !isEditionGlobe) {
   throw new Error('Outlook publication blocked: the opening cover must use the original NavvyaSignal artwork');
  }
  if (hero.toString('ascii', 0, 4) !== 'RIFF' || hero.toString('ascii', 8, 12) !== 'WEBP') {
   throw new Error(`Outlook publication blocked: ${slug} hero is not WebP`);
  }
  return {
   slug, title: read(slug, 'title.txt').toString().trim(), summary: read(slug, 'bluf.txt').toString().trim(),
   body: read(slug, 'body.html').toString(), sources: JSON.parse(read(slug, 'sources.json').toString()),
   imageAlt: isEditionGlobe ? 'Earth at sunrise with glowing connections between continents' : section.alt, hero, publishedAt: publicationDate,
  };
 });
}

export const outlookArticleUrl = (slug: string) => outlookOrigin + outlookPath + '/' + slug;
export const outlookArtworkPath = (slug: string) => outlookPath + '/artwork/' + slug + '.webp';
const xml = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
const home = outlookOrigin + outlookPath;

export function outlookResponse(format: 'rss' | 'atom' | 'json' | 'sitemap') {
 const entries = getPublishedOutlook();
 if (!entries.length) return new Response('Not found', {status:404, headers:{'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store'}});
 const updated = entries[0].publishedAt;
 if (format === 'json') return new Response(JSON.stringify({
  version:'https://jsonfeed.org/version/1.1', title:outlookSeriesTitle, home_page_url:home,
  feed_url:home+'/feed.json', description:outlookDescription,
  items:entries.map(e => ({id:outlookArticleUrl(e.slug),url:outlookArticleUrl(e.slug),title:e.title,summary:e.summary,content_text:e.summary,date_published:e.publishedAt})),
 }), {headers:{'Content-Type':'application/feed+json; charset=utf-8'}});
 if (format === 'sitemap') return new Response(xmlHeader+'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+
  [home,...entries.map(e=>outlookArticleUrl(e.slug))].map(url=>`<url><loc>${xml(url)}</loc><lastmod>${updated}</lastmod></url>`).join('')+'</urlset>',
  {headers:{'Content-Type':'application/xml; charset=utf-8'}});
 if (format === 'atom') return new Response(xmlHeader+`<feed xmlns="http://www.w3.org/2005/Atom"><title>${xml(outlookSeriesTitle)}</title><id>${home}</id><updated>${updated}</updated><author><name>NavvyaSignal</name></author><link href="${home}"/><link rel="self" href="${home}/atom.xml"/>`+
  entries.map(e=>`<entry><id>${outlookArticleUrl(e.slug)}</id><link href="${outlookArticleUrl(e.slug)}"/><title>${xml(e.title)}</title><updated>${e.publishedAt}</updated><summary>${xml(e.summary)}</summary></entry>`).join('')+'</feed>',
  {headers:{'Content-Type':'application/atom+xml; charset=utf-8'}});
 return new Response(xmlHeader+`<rss version="2.0"><channel><title>${xml(outlookSeriesTitle)}</title><link>${home}</link><description>${xml(outlookDescription)}</description>`+
  entries.map(e=>`<item><guid>${outlookArticleUrl(e.slug)}</guid><link>${outlookArticleUrl(e.slug)}</link><title>${xml(e.title)}</title><description>${xml(e.summary)}</description><pubDate>${new Date(e.publishedAt).toUTCString()}</pubDate></item>`).join('')+'</channel></rss>',
  {headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});
}
