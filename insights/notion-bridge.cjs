// Insights & Analysis publication bridge. Framework-independent and fail-closed.
//
// Isolation: reads ONLY the dedicated Insights data source. It refuses to run against the
// Signal Feed data source, never changes workflows, schedules, homepage fields or builds, and never
// calls any deployment hook. It writes at most two things, and only on an explicit action:
//   - revoke(): returns a materially revised article to In Review (Status, Ready to Post, Approval Fingerprint)
//   - approve(): records the Approval Fingerprint of an already approved, verified revision
// A checkbox change alone can never publish: an article is public only if every gate in evaluate() passes,
// including a stored approval fingerprint that matches the current Title, BLUF, body and Sources.
'use strict';
const crypto = require('node:crypto');

const SIGNAL_FEED_DATA_SOURCE_ID = '35b11486-b145-80ac-891f-000bd4c62627';
const DEFAULT_INSIGHTS_DATA_SOURCE_ID = '41c11486-b145-81ae-8704-000b814cf601';
const NOTION_VERSION = '2025-09-03';
const MAX_PAGES = 1000;
const FINGERPRINT_VERSION = 'v1';

// Explicit, closed mappings. Anything not listed makes the article ineligible; nothing is guessed.
const CATEGORY_MAP = Object.freeze({
  'Analysis': 'Analysis',
  'Explainer': 'Explainers',
  'The World Ahead': 'The World Ahead',
  'Special Report': 'Special Reports'
});
const SCOPE_MAP = Object.freeze({
  'Cross-Desk': 'Cross-Desk',
  'North America': 'North America',
  'Europe': 'Europe',
  'India & Subcontinent': 'India & Subcontinent',
  'UAE & Middle East': 'UAE & Middle East'
});
const PUBLISHABLE_STATUSES = Object.freeze(['Approved', 'Published']);
const REQUIRED_PROPERTIES = Object.freeze([
  'Title', 'Slug', 'Subtitle / BLUF', 'Category', 'Editorial Scope', 'Status', 'Ready to Post', 'Verification Status',
  'Publish At', 'Published At', 'Updated At', 'Author', 'SEO Title', 'Meta Description', 'Hero Image URL',
  'Hero Alt Text', 'Sources', 'Editorial Notes', 'Series', 'Series Part', 'Approval Fingerprint'
]);
// The only properties the bridge may ever write.
const REVOKE_PROPERTIES = Object.freeze(['Status', 'Ready to Post', 'Approval Fingerprint']);
const APPROVE_PROPERTIES = Object.freeze(['Approval Fingerprint']);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const norm = (s) => String(s ?? '').normalize('NFC').replace(/\r\n?/g, '\n').trim();

// ---------- Notion property readers ----------
const richText = (p) => norm(((p && (p.title || p.rich_text)) || []).map((t) => (t && t.plain_text) || '').join(''));
const selectName = (p) => (p && p.select && p.select.name) || '';
const multiNames = (p) => ((p && p.multi_select) || []).map((o) => o.name);
const dateStart = (p) => (p && p.date && p.date.start) || null;

// ---------- Page body (blocks) ----------
const TEXT_BLOCKS = new Set(['paragraph', 'heading_1', 'heading_2', 'heading_3', 'bulleted_list_item', 'numbered_list_item', 'quote']);
function blocksToParagraphs(blocks) {
  const paragraphs = [];
  const problems = [];
  let n = 0;
  for (const b of blocks || []) {
    if (!TEXT_BLOCKS.has(b.type)) { problems.push(`unsupported_block:${b.type}`); continue; }
    if (b.has_children) { problems.push('unsupported_nested_blocks'); continue; }
    const t = richText(b[b.type]);
    if (!t) continue;
    if (b.type === 'bulleted_list_item') paragraphs.push(`• ${t}`);
    else if (b.type === 'numbered_list_item') paragraphs.push(`${++n}. ${t}`);
    else paragraphs.push(t);
    if (b.type !== 'numbered_list_item') n = 0;
  }
  return { paragraphs, problems };
}

// ---------- Sources: every line needs an https URL ----------
function parseSources(raw) {
  const sources = [];
  const problems = [];
  for (const line of norm(raw).split('\n').map((l) => l.trim()).filter(Boolean)) {
    const m = line.match(/https:\/\/[^\s)>\]]+/);
    if (!m) { problems.push('sources_missing_url'); continue; }
    let url;
    try { url = new URL(m[0]); } catch { problems.push('sources_invalid_url'); continue; }
    if (url.protocol !== 'https:' || url.username || url.password) { problems.push('sources_invalid_url'); continue; }
    const label = norm(line.replace(m[0], '').replace(/[|—–\-:()\[\]]+\s*$/g, '').replace(/^[|—–\-:()\[\]\s]+/g, '')) || url.hostname;
    sources.push({ label, url: url.toString() });
  }
  return { sources, problems };
}

// ---------- Content fingerprint (Title + BLUF + body + Sources only) ----------
function fingerprint({ title, bluf, body, sources }) {
  const canonical = JSON.stringify({
    v: FINGERPRINT_VERSION, title: norm(title), bluf: norm(bluf),
    body: (body || []).map(norm), sources: (sources || []).map((s) => ({ label: norm(s.label), url: s.url }))
  });
  return `${FINGERPRINT_VERSION}:${crypto.createHash('sha256').update(canonical).digest('hex')}`;
}

// ---------- Normalisation: a Notion page (+ body blocks) -> internal record ----------
function normalizePage(page, blocks) {
  const props = page.properties || {};
  const problems = [];
  for (const name of REQUIRED_PROPERTIES) if (!(name in props)) problems.push(`missing_property:${name}`);
  const { paragraphs, problems: bodyProblems } = blocksToParagraphs(blocks);
  const { sources, problems: sourceProblems } = parseSources(richText(props.Sources));
  const record = {
    id: page.id,
    title: richText(props.Title),
    slug: richText(props.Slug),
    bluf: richText(props['Subtitle / BLUF']),
    categoryRaw: selectName(props.Category),
    scopesRaw: multiNames(props['Editorial Scope']),
    status: selectName(props.Status),
    ready: !!(props['Ready to Post'] && props['Ready to Post'].checkbox === true),
    verification: selectName(props['Verification Status']),
    publishAt: dateStart(props['Publish At']),
    publishedAt: dateStart(props['Published At']),
    updatedAt: dateStart(props['Updated At']),
    author: richText(props.Author),
    seoTitle: richText(props['SEO Title']),
    metaDescription: richText(props['Meta Description']),
    heroImage: (props['Hero Image URL'] && props['Hero Image URL'].url) || '',
    heroAlt: richText(props['Hero Alt Text']),
    series: richText(props.Series),
    seriesPart: props['Series Part'] && Number.isFinite(props['Series Part'].number) ? props['Series Part'].number : null,
    approvalFingerprint: richText(props['Approval Fingerprint']),
    body: paragraphs,
    sources,
    structuralProblems: [...problems, ...bodyProblems, ...sourceProblems],
    // PRIVATE: never read by toPublic(); guarded again by assertNoPrivateLeak().
    private: { editorialNotes: richText(props['Editorial Notes']) }
  };
  record.fingerprint = fingerprint(record);
  return record;
}

// ---------- Gates ----------
function evaluate(record, now = new Date()) {
  const r = [...record.structuralProblems];
  if (!PUBLISHABLE_STATUSES.includes(record.status)) r.push('status_not_approved');
  if (record.ready !== true) r.push('ready_to_post_unchecked');
  if (record.verification !== 'Verified') r.push('verification_not_verified');
  if (!CATEGORY_MAP[record.categoryRaw]) r.push('unmapped_category');
  if (!record.scopesRaw.length || record.scopesRaw.some((s) => !SCOPE_MAP[s])) r.push('unmapped_or_missing_scope');
  if (!SLUG_RE.test(record.slug)) r.push('invalid_slug');
  for (const [k, v] of [['title', record.title], ['bluf', record.bluf], ['author', record.author]]) if (!v) r.push(`missing_${k}`);
  if (!record.body.length) r.push('empty_body');
  if (!record.sources.length) r.push('no_valid_sources');
  const when = record.publishedAt || record.publishAt;
  if (!when || !Number.isFinite(Date.parse(when))) r.push('missing_publication_date');
  else if (record.publishAt && Date.parse(record.publishAt) > now.getTime()) r.push('scheduled_in_future');
  else if (Date.parse(when) > now.getTime()) r.push('scheduled_in_future');
  if (record.updatedAt && !Number.isFinite(Date.parse(record.updatedAt))) r.push('invalid_updated_at');
  if (record.heroImage && (!/^https:\/\//.test(record.heroImage) || !record.heroAlt)) r.push('hero_requires_https_and_alt');
  if (!record.approvalFingerprint) r.push('approval_fingerprint_missing');
  else if (record.approvalFingerprint !== record.fingerprint) r.push('approval_fingerprint_mismatch');
  return { eligible: r.length === 0, reasons: [...new Set(r)] };
}

function toPublic(record) {
  // Explicit allowlist. editorialNotes and every other private field are never copied.
  const publishedAt = new Date(record.publishedAt || record.publishAt).toISOString();
  const modifiedAt = new Date(record.updatedAt || record.publishedAt || record.publishAt).toISOString();
  const out = {
    slug: record.slug, title: record.title, subtitle: record.bluf,
    summary: record.metaDescription || record.bluf,
    category: CATEGORY_MAP[record.categoryRaw], desk: record.scopesRaw.map((s) => SCOPE_MAP[s]).join(' · '),
    author: record.author, publishedAt, modifiedAt, body: record.body, sources: record.sources,
    status: 'Published', public: true
  };
  if (record.heroImage) { out.heroImage = record.heroImage; out.heroAlt = record.heroAlt; }
  if (record.seoTitle) out.seoTitle = record.seoTitle;
  if (record.metaDescription) out.seoDescription = record.metaDescription;
  if (record.series) out.series = record.series;
  if (record.seriesPart !== null) out.seriesPart = record.seriesPart;
  return out;
}

function assertNoPrivateLeak(articles, records) {
  const blob = norm(JSON.stringify(articles));
  for (const r of records) {
    const n = norm(r.private && r.private.editorialNotes);
    if (n.length >= 8 && blob.includes(JSON.stringify(n).slice(1, -1))) throw new Error('Private editorial notes leaked into public output');
  }
}

function buildSnapshot(records, { now = new Date() } = {}) {
  const bySlug = new Map();
  for (const r of records) if (r.slug && r.status !== 'Archived') bySlug.set(r.slug, (bySlug.get(r.slug) || 0) + 1);
  const articles = [];
  const excluded = [];
  for (const r of records) {
    const verdict = evaluate(r, now);
    if (bySlug.get(r.slug) > 1 && r.status !== 'Archived') verdict.reasons.push('duplicate_slug');
    if (verdict.reasons.length === 0) articles.push(toPublic(r));
    else excluded.push({ id: r.id, slug: r.slug || null, reasons: [...new Set(verdict.reasons)] });
  }
  articles.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  assertNoPrivateLeak(articles, records);
  return { articles, excluded };
}
const serializeSnapshot = (articles) => `${JSON.stringify(articles, null, 1)}\n`;

// ---------- Controlled Notion writes ----------
function revokeBody() {
  return { properties: { 'Status': { select: { name: 'In Review' } }, 'Ready to Post': { checkbox: false }, 'Approval Fingerprint': { rich_text: [] } } };
}
function approveBody(fp) {
  return { properties: { 'Approval Fingerprint': { rich_text: [{ type: 'text', text: { content: fp } }] } } };
}
function revisedAfterApproval(r) {
  return !!r.approvalFingerprint && r.approvalFingerprint !== r.fingerprint &&
    (PUBLISHABLE_STATUSES.includes(r.status) || r.ready === true);
}
// Material revision (Title, BLUF, body or Sources changed since approval) -> back to In Review, unchecked.
async function reconcileRevisions(records, { patchPage, apply = false } = {}) {
  const actions = [];
  for (const r of records) {
    if (!revisedAfterApproval(r)) continue;
    if (apply) {
      if (typeof patchPage !== 'function') throw new Error('patchPage required to apply revocations');
      await patchPage(r.id, revokeBody());
    }
    actions.push({ id: r.id, slug: r.slug || null, action: 'return_to_in_review', applied: !!apply });
  }
  return actions;
}
// Explicit human-triggered action: records the fingerprint of the revision being approved.
async function approveRevision(record, { patchPage, now = new Date() } = {}) {
  const verdict = evaluate({ ...record, approvalFingerprint: record.fingerprint }, now);
  if (!verdict.eligible) return { approved: false, reasons: verdict.reasons };
  await patchPage(record.id, approveBody(record.fingerprint));
  return { approved: true, fingerprint: record.fingerprint };
}

// ---------- Notion client (injectable fetch; never logs secrets or content) ----------
function createClient({ token, dataSourceId, fetchImpl = globalThis.fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) }) {
  if (!token) throw new Error('Insights bridge refused: NOTION_API_KEY not configured');
  if (!dataSourceId) throw new Error('Insights bridge refused: Insights data source id not configured');
  if (dataSourceId.replace(/-/g, '') === SIGNAL_FEED_DATA_SOURCE_ID.replace(/-/g, '')) {
    throw new Error('Insights bridge refused: configured data source is the Signal Feed');
  }
  const headers = { Authorization: `Bearer ${token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' };
  async function call(method, url, body) {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(url, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
      if (res.ok) return res.json();
      if ([429, 502, 503, 504].includes(res.status) && attempt < 2) { await sleep(500 * 2 ** attempt); continue; }
      throw new Error(`Notion request failed with status ${res.status}`); // never include response or request content
    }
  }
  return {
    async queryAllPages() {
      const pages = [];
      let cursor;
      do {
        const out = await call('POST', `https://api.notion.com/v1/data_sources/${dataSourceId}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
        pages.push(...out.results);
        if (pages.length > MAX_PAGES) throw new Error('Insights query exceeded safety ceiling');
        cursor = out.has_more ? out.next_cursor : undefined;
      } while (cursor);
      return pages;
    },
    async getBlocks(pageId) {
      const blocks = [];
      let cursor;
      do {
        const out = await call('GET', `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ''}`);
        blocks.push(...out.results);
        cursor = out.has_more ? out.next_cursor : undefined;
      } while (cursor);
      return blocks;
    },
    async patchPage(pageId, body) {
      const keys = Object.keys(body.properties || {});
      const allowed = (keys.length === 1 && keys[0] === 'Approval Fingerprint') || keys.slice().sort().join() === [...REVOKE_PROPERTIES].sort().join();
      if (!allowed || Object.keys(body).length !== 1) throw new Error('Insights bridge refused: write outside the controlled property set');
      return call('PATCH', `https://api.notion.com/v1/pages/${pageId}`, body);
    }
  };
}

async function loadRecords(client) {
  const pages = await client.queryAllPages();
  const records = [];
  for (const page of pages) {
    const status = selectName((page.properties || {}).Status);
    // Drafts and archived pages are never publishable; skip their body fetch.
    const needsBody = PUBLISHABLE_STATUSES.includes(status) || ((page.properties || {})['Ready to Post'] || {}).checkbox === true;
    records.push(normalizePage(page, needsBody ? await client.getBlocks(page.id) : []));
  }
  return records;
}

module.exports = {
  SIGNAL_FEED_DATA_SOURCE_ID, DEFAULT_INSIGHTS_DATA_SOURCE_ID, CATEGORY_MAP, SCOPE_MAP, PUBLISHABLE_STATUSES,
  REQUIRED_PROPERTIES, REVOKE_PROPERTIES, APPROVE_PROPERTIES,
  fingerprint, normalizePage, blocksToParagraphs, parseSources, evaluate, toPublic, assertNoPrivateLeak,
  buildSnapshot, serializeSnapshot, reconcileRevisions, approveRevision, revokeBody, approveBody, createClient, loadRecords
};
