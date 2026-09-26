import { networkVentures, type NetworkVenture } from './network';
export type NetworkCard = NetworkVenture & { image: string | null; displayTitle: string; displayDescription: string; metadataVerified: boolean };
function readMeta(html: string, key: string): string | null {
 const tags = html.match(/<meta\s+[^>]*>/gi) ?? [];
 for (const tag of tags) {
  const attrs: Record<string,string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[match[1].toLowerCase()] = match[3];
  if (attrs.property === key || attrs.name === key) return attrs.content ?? null;
 }
 return null;
}
function clean(s: string | null, max: number): string | null {
 if (!s) return null;
 const text = s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]+>/g,'').trim();
 return text ? text.slice(0,max) : null;
}
async function loadCard(v: NetworkVenture): Promise<NetworkCard> {
 const fallback: NetworkCard = {...v,image:null,displayTitle:v.name,displayDescription:v.description,metadataVerified:false};
 // CI must be deterministic; live public metadata is optional, never a build prerequisite.
 if (process.env.CI === 'true' && process.env.V2_CI_STATIC_FIXTURE === '1') return fallback;
 try {
  const res = await fetch(v.url,{signal:AbortSignal.timeout(3500),headers:{'User-Agent':'NavvyaSignalPreview/1.0 (public OG metadata)'}});
  if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return fallback;
  const html = (await res.text()).slice(0,200000);
  // Prefer the site's own social image; use its declared logo/icon only when no hero is supplied.
  const rawImage = readMeta(html,'og:image:secure_url') ?? readMeta(html,'og:image') ?? readMeta(html,'twitter:image') ??
    (html.match(/<link\\s+[^>]*rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["'][^>]*>/i)?.[0].match(/href=["']([^"']+)["']/i)?.[1] ?? null) ??
    (html.match(/<link\\s+[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*(?:apple-touch-icon|icon)[^"']*["']/i)?.[1] ?? null);
  let image: string | null = null;
  if (rawImage) {
   const u = new URL(rawImage, v.url);
   const baseHost = new URL(v.url).hostname.replace(/^www\\./,'');
   const imageHost = u.hostname.replace(/^www\\./,'');
   if (u.protocol === 'https:' && !u.username && !u.password &&
      (imageHost === baseHost || imageHost.endsWith('.' + baseHost))) image = u.toString();
  }
  return {...fallback,image,displayTitle:clean(readMeta(html,'og:title'),95) ?? v.name,
   displayDescription:clean(readMeta(html,'og:description') ?? readMeta(html,'description'),190) ?? v.description,
   metadataVerified:!!image};
 } catch { return fallback; }
}
export async function getNetworkCards(): Promise<NetworkCard[]> {
 return Promise.all(networkVentures.map(loadCard));
}
