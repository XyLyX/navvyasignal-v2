import {getPublishedOutlook} from '@/lib/strategicOutlookPublication';

export const dynamicParams = false;
export function generateStaticParams() {
 const entries = getPublishedOutlook();
 return entries.length ? entries.map(e => ({file:e.slug+'.webp'})) : [{file:'unpublished'}];
}
export async function GET(_: Request, {params}: {params: Promise<{file:string}>}) {
 const {file} = await params;
 const section = getPublishedOutlook().find(e => e.slug+'.webp' === file);
 return section ? new Response(new Uint8Array(section.hero), {headers:{'Content-Type':'image/webp'}})
  : new Response(null, {status:404});
}
