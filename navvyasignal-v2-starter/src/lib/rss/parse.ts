import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { FeedSource } from './sources.ts';

// Pure, network-free RSS/Atom normalisation. Everything returned is plain text or a validated https URL;
// feed HTML is never passed through to the page.

export type FeedItem = {
  sourceId: string;
  title: string;
  /** Original article URL as published (fragment and tracking parameters removed). */
  url: string;
  canonicalUrl: string;
  /** ISO 8601 UTC instant taken from the item's own date field. */
  publishedAt: string;
  excerpt: string | null;
  /** Position within the source feed: the publisher's own order for items that share a timestamp. */
  feedIndex: number;
  /** Article-level image; never a site-wide fallback. */
  imageUrl: string | null;
  /** Where imageUrl came from: the feed item itself, or the article page's own Open Graph image. */
  imageSource: 'feed' | 'og' | null;
  /** True when a strict UTF-8-read-as-Windows-1252 repair was applied to the title or excerpt. */
  encodingRepaired: boolean;
};

export type RejectReason = 'not-an-item' | 'missing-title' | 'invalid-link' | 'missing-date' | 'invalid-date' | 'future-date';
export type ParsedFeed = { items: FeedItem[]; rejected: { index: number; reason: RejectReason }[]; totalItems: number };

export class FeedParseError extends Error {
  code: 'empty-document' | 'doctype-forbidden' | 'malformed-xml' | 'unsupported-format';
  constructor(code: FeedParseError['code'], message: string) { super(message); this.name = 'FeedParseError'; this.code = code; }
}

const MAX_TITLE = 300;
const MAX_EXCERPT = 260;
const FUTURE_TOLERANCE_MS = 24 * 3600 * 1000;
const MIN_YEAR = 1995;

// ---------- text ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '\u2013', mdash: '\u2014', lsquo: '\u2018', rsquo: '\u2019',
  ldquo: '\u201c', rdquo: '\u201d', hellip: '\u2026', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', bull: '\u2022', middot: '\u00b7',
  euro: '\u20ac', pound: '\u00a3', laquo: '\u00ab', raquo: '\u00bb',
};

function codePointText(cp: number): string | null {
  if (!Number.isInteger(cp) || cp < 0x20 || cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) || (cp >= 0x7f && cp <= 0x9f)) return null;
  return String.fromCodePoint(cp);
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#[0-9]{1,7}|[a-z][a-z0-9]{1,8});/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const cp = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return codePointText(cp) ?? '';
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const TAG = /<\/?[a-z][a-z0-9:-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;

/** Reduce feed HTML to plain text: drops active/embedded elements, comments and tags, decodes entities once. */
export function htmlToText(input: string): string {
  let s = input;
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  s = s.replace(/<(script|style|iframe|object|embed|noscript|template|svg)\b[\s\S]*$/gi, ' '); // unterminated
  s = s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<!--[\s\S]*$/g, ' ');
  s = s.replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|table|section|article)\s*>|<br\s*\/?>/gi, ' ');
  s = s.replace(TAG, '');
  s = decodeEntities(s);
  return collapse(s);
}

function collapse(s: string): string {
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200d\u2028\u2029\ufeff]/g, ' ').replace(/\s+/g, ' ').trim();
}

const CP1252_HIGH: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};
// A UTF-8 lead byte (C2-F4) read as Windows-1252 followed by a continuation byte read the same way.
const MOJIBAKE_HINT = /[\u00c2-\u00f4][\u0080-\u00bf\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac\u2122]/;

/**
 * Conservative repair for text whose UTF-8 bytes were decoded as Windows-1252 (e.g. an em dash shown as three Latin-1 symbols).
 * The whole string must round-trip as strict UTF-8; otherwise the original is returned untouched.
 */
export function repairMojibake(s: string): { text: string; repaired: boolean } {
  if (!MOJIBAKE_HINT.test(s)) return { text: s, repaired: false };
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x80) bytes.push(cp);
    else if (cp <= 0xff && !(cp >= 0x80 && cp <= 0x9f)) bytes.push(cp);
    else if (CP1252_HIGH[cp] !== undefined) bytes.push(CP1252_HIGH[cp]);
    else return { text: s, repaired: false };
  }
  try {
    const fixed = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bytes));
    return fixed !== s && !fixed.includes('\ufffd') ? { text: fixed, repaired: true } : { text: s, repaired: false };
  } catch { return { text: s, repaired: false }; }
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.\-\u2013\u2014]+$/, '') + '\u2026';
}

// ---------- dates ----------

const RFC822 = /^(?:[A-Za-z]{3,9},?\s+)?(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(GMT|UTC|Z|[+-]\d{4}|[ECMP][SD]T)$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2}))?$/;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const US_ZONES: Record<string, number> = { EST: -5, EDT: -4, CST: -6, CDT: -5, MST: -7, MDT: -6, PST: -8, PDT: -7 };

function offsetMinutes(zone: string): number {
  if (/^(GMT|UTC|Z)$/i.test(zone)) return 0;
  if (US_ZONES[zone.toUpperCase()] !== undefined) return US_ZONES[zone.toUpperCase()] * 60;
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(zone)!;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

/** Strict, timezone-explicit date parser. Returns null rather than guessing. */
export function parseFeedDate(raw: string | undefined | null, now: Date): { iso: string } | { error: 'missing-date' | 'invalid-date' | 'future-date' } {
  const s = (raw ?? '').trim();
  if (!s) return { error: 'missing-date' };
  let y: number, mo: number, d: number, h = 0, mi = 0, sec = 0, off = 0;
  let m = RFC822.exec(s);
  if (m) {
    d = Number(m[1]); mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()); y = Number(m[3]); h = Number(m[4]); mi = Number(m[5]); sec = Number(m[6] ?? 0); off = offsetMinutes(m[7]);
    if (mo < 0) return { error: 'invalid-date' };
  } else if ((m = ISO.exec(s))) {
    y = Number(m[1]); mo = Number(m[2]) - 1; d = Number(m[3]);
    if (m[4] !== undefined) { h = Number(m[4]); mi = Number(m[5]); sec = Number(m[6] ?? 0); off = offsetMinutes(m[7]); }
  } else return { error: 'invalid-date' };
  if (h > 23 || mi > 59 || sec > 59 || d < 1 || d > 31) return { error: 'invalid-date' };
  const utc = Date.UTC(y, mo, d, h, mi, sec);
  const check = new Date(utc);
  if (check.getUTCDate() !== d || check.getUTCMonth() !== mo || y < MIN_YEAR) return { error: 'invalid-date' }; // e.g. 31 Feb
  const ms = utc - off * 60000;
  if (ms > now.getTime() + FUTURE_TOLERANCE_MS) return { error: 'future-date' };
  return { iso: new Date(ms).toISOString() };
}

// ---------- urls ----------

const TRACKING_PARAM = /^(utm_.+|fbclid|gclid|msclkid|mc_cid|mc_eid|ref|ref_src|igshid)$/i;

/** Validates an https URL on an allowlisted host and returns the display URL plus a dedupe key. */
export function cleanUrl(raw: unknown, allowedHosts: readonly string[], base?: string): { url: string; canonical: string } | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.length > 2048 || /[\u0000-\u001f\s]/.test(t)) return null;
  let u: URL;
  try { u = new URL(t, base); } catch { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
  if (!allowedHosts.includes(u.hostname.toLowerCase())) return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (TRACKING_PARAM.test(k)) u.searchParams.delete(k);
  u.searchParams.sort();
  const url = u.toString();
  const path = u.pathname.replace(/\/+$/, '') || '/';
  const canonical = `https://${u.hostname.toLowerCase().replace(/^www\./, '')}${path}${u.search}`;
  return { url, canonical };
}

// ---------- xml ----------

type Node = Record<string, unknown>;
const ARRAY_TAGS = new Set(['item', 'entry', 'media:content', 'media:thumbnail', 'enclosure', 'link', 'media:group']);

function makeParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false, attributeNamePrefix: '@_', parseTagValue: false, parseAttributeValue: false, trimValues: true,
    processEntities: true, htmlEntities: false, ignoreDeclaration: true, ignorePiTags: true, stopNodes: [],
    isArray: name => ARRAY_TAGS.has(name),
  });
}

function textOf(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return textOf(v[0]);
  if (typeof v === 'object') return textOf((v as Node)['#text']);
  return '';
}
const attr = (n: unknown, name: string): string => (n && typeof n === 'object' ? textOf((n as Node)['@_' + name]) : '');
const asArray = (v: unknown): unknown[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

function firstHref(item: Node): string {
  const links = asArray(item.link);
  for (const l of links) {
    if (typeof l === 'string') return l;
    const rel = attr(l, 'rel');
    if (attr(l, 'href') && (!rel || rel === 'alternate')) return attr(l, 'href');
    const t = textOf(l); if (t) return t;
  }
  return '';
}

const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i;

function pickImage(item: Node, source: FeedSource, articleUrl: string): string | null {
  const cands: { url: string; ok: boolean }[] = [];
  const groups = asArray(item['media:group']) as Node[];
  const contents = [...asArray(item['media:content']), ...groups.flatMap(g => asArray(g['media:content']))];
  for (const c of contents) {
    const type = attr(c, 'type').toLowerCase(), medium = attr(c, 'medium').toLowerCase(), url = attr(c, 'url');
    cands.push({ url, ok: medium === 'image' || type.startsWith('image/') || (!type && !medium && IMAGE_EXT.test(url)) });
  }
  for (const t of [...asArray(item['media:thumbnail']), ...groups.flatMap(g => asArray(g['media:thumbnail']))]) cands.push({ url: attr(t, 'url'), ok: true });
  for (const e of asArray(item.enclosure)) cands.push({ url: attr(e, 'url'), ok: attr(e, 'type').toLowerCase().startsWith('image/') });
  for (const c of cands) {
    if (!c.ok) continue;
    const u = cleanUrl(c.url, source.allowedHosts, articleUrl);
    if (u) return u.url;
  }
  return null;
}

function cleanTitle(raw: string): { text: string; repaired: boolean } {
  // Titles are plain text: only strip when real markup is present, so legitimate punctuation is left alone.
  const hasMarkup = /<\/?[a-z][^>]*>/i.test(raw);
  const base = hasMarkup ? htmlToText(raw) : collapse(decodeEntities(raw));
  return repairMojibake(base);
}

/**
 * Parse an RSS 2.0 (or basic Atom) document into normalised, validated items. Malformed items are rejected
 * individually; a malformed document throws FeedParseError.
 */
export function parseFeed(xml: string, source: FeedSource, now: Date = new Date()): ParsedFeed {
  const body = xml.replace(/^\ufeff/, '');
  if (!body.trim()) throw new FeedParseError('empty-document', 'Empty response body');
  if (/<!DOCTYPE|<!ENTITY/i.test(body)) throw new FeedParseError('doctype-forbidden', 'DOCTYPE/ENTITY declarations are not accepted');
  let doc: Node;
  try {
    const valid = XMLValidator.validate(body);
    if (valid !== true) throw new FeedParseError('malformed-xml', valid.err.msg);
    doc = makeParser().parse(body) as Node;
  } catch (e) {
    if (e instanceof FeedParseError) throw e;
    throw new FeedParseError('malformed-xml', e instanceof Error ? e.message : 'Malformed XML');
  }
  const rss = doc.rss as Node | undefined, atom = doc.feed as Node | undefined;
  const rawItems: Node[] = rss
    ? (rss.channel && typeof rss.channel === 'object' ? (asArray((rss.channel as Node).item) as Node[]) : (() => { throw new FeedParseError('unsupported-format', 'RSS document has no channel'); })())
    : atom ? (asArray(atom.entry) as Node[]) : (() => { throw new FeedParseError('unsupported-format', 'Root element is neither rss nor feed'); })();

  const items: FeedItem[] = [];
  const rejected: ParsedFeed['rejected'] = [];
  rawItems.forEach((raw, index) => {
    const reject = (reason: RejectReason) => { rejected.push({ index, reason }); };
    if (!raw || typeof raw !== 'object') return reject('not-an-item');
    const title = cleanTitle(textOf(raw.title));
    if (!title.text || title.text.length > MAX_TITLE) return reject('missing-title');
    const link = cleanUrl(firstHref(raw), source.allowedHosts);
    if (!link) return reject('invalid-link');
    const dateRaw = textOf(raw.pubDate) || textOf(raw['dc:date']) || textOf(raw.published) || textOf(raw.updated);
    const date = parseFeedDate(dateRaw, now);
    if ('error' in date) return reject(date.error);
    const excerptRaw = textOf(raw.description) || textOf(raw.summary) || textOf(raw['content:encoded']) || textOf(raw.content);
    const ex = repairMojibake(htmlToText(excerptRaw));
    const excerpt = ex.text && ex.text.toLowerCase() !== title.text.toLowerCase() ? truncate(ex.text, MAX_EXCERPT) : null;
    const img = pickImage(raw, source, link.url);
    items.push({
      sourceId: source.id, title: title.text, url: link.url, canonicalUrl: link.canonical, publishedAt: date.iso, excerpt,
      feedIndex: index, imageUrl: img, imageSource: img ? 'feed' : null, encodingRepaired: title.repaired || (!!excerpt && ex.repaired),
    });
  });
  return { items, rejected, totalItems: rawItems.length };
}
