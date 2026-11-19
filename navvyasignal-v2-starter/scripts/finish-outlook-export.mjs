import {rmSync} from 'node:fs';

// A static export cannot carry route-level 404 status to every host.
// Remove Outlook output unless this build explicitly includes a private or approved edition.
const isProduction = process.env.NEXT_PUBLIC_V2_PRODUCTION === 'true';
const isApproved = isProduction;
const isPreview = !isProduction && process.env.STRATEGIC_OUTLOOK_PRIVATE_PREVIEW === 'true' &&
 Boolean(process.env.STRATEGIC_OUTLOOK_MANUSCRIPTS);
if (!isApproved && !isPreview) {
 for (const file of ['out/strategic-outlook', 'out/strategic-outlook.html', 'out/strategic-outlook.txt']) {
  rmSync(file, {recursive:true, force:true});
 }
}
if (isPreview) {
 for (const file of ['rss.xml', 'atom.xml', 'feed.json', 'sitemap.xml', 'artwork']) {
  rmSync('out/strategic-outlook/'+file, {recursive:true, force:true});
 }
}
