import { cleanUrl, type FeedItem } from './parse.ts';
import { readCapped } from './fetch.ts';
import type { SourceResult } from './service.ts';

// Build-time lookup of an article's own Open Graph image, used only when the feed item carries no image.
// A candidate must be https on an allowlisted host, must not be the site-wide default or a logo/icon, and must
// answer as a real image. Anything that fails leaves the item without an image (branded text tile).

export type OgOptions = { fetchImpl?: typeof fetch; timeoutMs?: number; maxHtmlBytes?: number; maxImageBytes?: number };

const GENERIC_NAME = /(^|[-_./])(og|og-?image|og-?default|default|logo|favicon|apple-touch-icon|icon|placeholder|sprite|share|social)([-_.]|$)/i;

export function isGenericImageUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname;
    const base = path.split('/').pop() ?? '';
    return GENERIC_NAME.test(base.replace(/\.[a-z0-9]+$/i, '')) || /\/(og|logos?|icons?|favicons?)\//i.test(path);
  } catch { return true; }
}

function metaContent(html: string, keys: string[]): string | null {
  for (const tag of html.match(/<meta\s+[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) attrs[m[1].toLowerCase()] = m[3];
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (keys.includes(key) && attrs.content) return attrs.content.replace(/&amp;/g, '&').trim();
  }
  return null;
}

/** Raw og:image (else twitter:image) declared by a page, resolved against the page URL; not yet validated. */
export function extractOgImage(html: string, pageUrl: string): string | null {
  const raw = metaContent(html, ['og:image:secure_url', 'og:image']) ?? metaContent(html, ['twitter:image', 'twitter:image:src']);
  if (!raw) return null;
  try { return new URL(raw, pageUrl).toString(); } catch { return null; }
}

/** Fetch with https-only, allowlisted-host redirects (max 3). Returns null on any failure. */
async function guardedFetch(url: string, hosts: readonly string[], init: RequestInit, f: typeof fetch): Promise<Response | null> {
  try {
    for (let hop = 0; hop <= 3; hop++) {
      const res = await f(url, { ...init, redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const next = cleanUrl(res.headers.get('location') ?? '', hosts, url);
        if (!next) return null;
        url = next.url;
        continue;
      }
      return res.ok ? res : null;
    }
  } catch { /* fall through */ }
  return null;
}

async function pageOg(url: string, hosts: readonly string[], o: Required<OgOptions>): Promise<string | null> {
  const res = await guardedFetch(url, hosts, { signal: AbortSignal.timeout(o.timeoutMs), headers: { Accept: 'text/html', 'User-Agent': 'NavvyaSignalPreview/1.0 (read-only OG lookup)' } }, o.fetchImpl);
  if (!res || !/^text\/html|^application\/xhtml/i.test(res.headers.get('content-type') ?? '')) return null;
  try {
    const bytes = await readCapped(res, o.maxHtmlBytes);
    return extractOgImage(new TextDecoder('utf-8').decode(bytes), url);
  } catch { return null; }
}

async function looksLikeImage(url: string, hosts: readonly string[], o: Required<OgOptions>): Promise<boolean> {
  const res = await guardedFetch(url, hosts, { method: 'HEAD', signal: AbortSignal.timeout(o.timeoutMs) }, o.fetchImpl);
  if (!res) return false;
  const type = (res.headers.get('content-type') ?? '').toLowerCase();
  const len = Number(res.headers.get('content-length'));
  return /^image\/(jpeg|png|webp|avif|gif)/.test(type) && (!Number.isFinite(len) || len <= o.maxImageBytes);
}

/**
 * For each displayed article without a feed image, look for that article's own OG image. Only the first `perSource`
 * items of each ok network source are examined. Never throws; returns new result objects.
 */
export async function enrichOgImages(results: SourceResult[], opts: OgOptions & { perSource: number; groups?: readonly string[] }): Promise<SourceResult[]> {
  const o: Required<OgOptions> = { fetchImpl: opts.fetchImpl ?? fetch, timeoutMs: opts.timeoutMs ?? 5000, maxHtmlBytes: opts.maxHtmlBytes ?? 512_000, maxImageBytes: opts.maxImageBytes ?? 5_000_000 };
  const groups = opts.groups ?? ['network'];
  return Promise.all(results.map(async r => {
    if (r.status !== 'ok' || !groups.includes(r.source.group)) return r;
    const need = r.items.slice(0, opts.perSource).filter(i => !i.imageUrl);
    if (!need.length) return r;
    const source = r.source;
    try {
      const siteOgRaw = await pageOg(new URL('/', source.siteUrl).toString(), source.allowedHosts, o);
      const siteOg = siteOgRaw ? cleanUrl(siteOgRaw, source.allowedHosts)?.url ?? null : null;
      const raws = await Promise.all(need.map(i => pageOg(i.url, source.allowedHosts, o)));
      const counts = new Map<string, number>();
      for (const u of raws) if (u) counts.set(u, (counts.get(u) ?? 0) + 1);
      const found = new Map<string, string>();
      for (let n = 0; n < need.length; n++) {
        const raw = raws[n];
        if (!raw) continue;
        const clean = cleanUrl(raw, source.allowedHosts, need[n].url);
        if (!clean || clean.url === siteOg || (counts.get(raw) ?? 0) > 1 || isGenericImageUrl(clean.url)) continue;
        if (await looksLikeImage(clean.url, source.allowedHosts, o)) found.set(need[n].canonicalUrl, clean.url);
      }
      if (!found.size) return r;
      const items: FeedItem[] = r.items.map(i => found.has(i.canonicalUrl) ? { ...i, imageUrl: found.get(i.canonicalUrl)!, imageSource: 'og' as const } : i);
      return { ...r, items };
    } catch { return r; }
  }));
}
