import type { FeedSource } from './sources.ts';

export type FetchOptions = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; fetchImpl?: typeof fetch };
export class FeedFetchError extends Error {
  code: 'http-status' | 'redirect' | 'content-type' | 'too-large' | 'timeout' | 'network';
  constructor(code: FeedFetchError['code'], message: string) { super(message); this.name = 'FeedFetchError'; this.code = code; }
}

const XML_TYPE = /(^|[/+])xml(\s*;|$)|^application\/(rss|atom)\+xml/i;

/** Fetch one allowlisted feed as text. Every redirect hop must stay https on the source's allowed hosts. */
export async function fetchFeedText(source: FeedSource, opts: FetchOptions = {}): Promise<string> {
  const { timeoutMs = 10_000, maxBytes = 1_000_000, maxRedirects = 3, fetchImpl = fetch } = opts;
  const deadline = AbortSignal.timeout(timeoutMs);
  let url = source.feedUrl;
  try {
    for (let hop = 0; ; hop++) {
      const res = await fetchImpl(url, {
        redirect: 'manual', signal: deadline,
        headers: { Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8', 'User-Agent': 'NavvyaSignalPreview/1.0 (read-only RSS importer)' },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        const next = loc ? safeUrl(loc, url) : null;
        if (hop >= maxRedirects || !next || next.protocol !== 'https:' || next.username || next.password || !source.allowedHosts.includes(next.hostname.toLowerCase()))
          throw new FeedFetchError('redirect', `Unacceptable redirect from ${url}`);
        url = next.toString();
        continue;
      }
      if (!res.ok) throw new FeedFetchError('http-status', `HTTP ${res.status}`);
      const type = res.headers.get('content-type') ?? '';
      if (!XML_TYPE.test(type.trim())) throw new FeedFetchError('content-type', `Unexpected content-type "${type}"`);
      const declared = Number(res.headers.get('content-length'));
      if (Number.isFinite(declared) && declared > maxBytes) throw new FeedFetchError('too-large', `Declared size ${declared} exceeds ${maxBytes}`);
      const bytes = await readCapped(res, maxBytes);
      return decodeBody(bytes, type);
    }
  } catch (e) {
    if (e instanceof FeedFetchError) throw e;
    if (deadline.aborted || (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError'))) throw new FeedFetchError('timeout', `Timed out after ${timeoutMs}ms`);
    throw new FeedFetchError('network', e instanceof Error ? e.message : 'Network error');
  }
}

function safeUrl(loc: string, base: string): URL | null { try { return new URL(loc, base); } catch { return null; } }

export async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array> {
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new FeedFetchError('too-large', `Body exceeds ${maxBytes} bytes`);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new FeedFetchError('too-large', `Body exceeds ${maxBytes} bytes`); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

/** Honour the XML prolog encoding, then the header charset, defaulting to UTF-8. */
export function decodeBody(bytes: Uint8Array, contentType: string): string {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
  const label = /^\s*<\?xml[^>]*encoding\s*=\s*["']([\w.-]+)["']/i.exec(head)?.[1] ?? /charset\s*=\s*"?([\w.-]+)/i.exec(contentType)?.[1] ?? 'utf-8';
  let decoder: TextDecoder;
  try { decoder = new TextDecoder(label); } catch { decoder = new TextDecoder('utf-8'); }
  return decoder.decode(bytes);
}
