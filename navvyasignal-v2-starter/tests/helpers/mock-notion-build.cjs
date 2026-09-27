// Optional end-to-end check (not run by `npm test`): NODE_OPTIONS="--require ./tests/helpers/mock-notion-build.cjs" NOTION_TOKEN=mock NOTION_DATA_SOURCE_ID=mock npm run build
// Synthetic Notion for an end-to-end static build. Serves fixtures for api.notion.com only; nothing is written anywhere.
const orig = globalThis.fetch;
const pg = (id, o) => ({ id, created_time: o.created, properties: {
  Name: { title: [{ plain_text: o.title }] }, 'Ready to Post': { checkbox: true },
  'Signal Brief': { rich_text: [{ plain_text: `Brief of ${o.title}.` }] }, 'Text 1': { rich_text: [{ plain_text: 'Sources: test.' }] },
  Category: { select: { name: o.cat } }, 'Content Type': { select: o.type ? { name: o.type } : null },
  "Today's Intelligence": { checkbox: !!o.today }, 'Homepage Date': { date: o.date ? { start: o.date } : null },
  'Homepage Priority': { number: o.pr ?? null }, Watchlist: { checkbox: false } } });
const rows = [
  pg('00000000-0000-0000-0000-000000000001', { title: 'EDITION-PICK-ONE', cat: 'UAE Desk', today: true, date: '2026-09-26', pr: 1, created: '2026-09-26T08:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000002', { title: 'EDITION-PICK-TWO', cat: 'West Asia Desk', today: true, date: '2026-09-26', pr: 2, created: '2026-09-26T09:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000003', { title: 'PLAIN-NOT-SELECTED', cat: 'India Desk', created: '2026-09-26T10:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000004', { title: 'PLAIN-CROSS-DESK', cat: 'Global Politics Desk', type: 'Cross-Desk', created: '2026-09-26T11:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000005', { title: 'PLAIN-BRIEFING', cat: 'West Asia Desk', type: 'Briefing', created: '2026-09-26T12:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000006', { title: 'PLAIN-LONG-READ', cat: 'Markets & Capital Desk', type: 'Long Read', created: '2026-09-26T13:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000007', { title: 'OLD-V1-HISTORICAL', cat: 'India Desk', created: '2026-08-01T08:00:00Z' }),
  pg('00000000-0000-0000-0000-000000000008', { title: 'OLDER-EDITION-PICK', cat: 'UAE Desk', today: true, date: '2026-09-25', pr: 1, created: '2026-09-25T08:00:00Z' }),
];
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith('https://api.notion.com/v1/data_sources/')) {
    return new Response(JSON.stringify({ results: rows, has_more: false, next_cursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (String(url).startsWith('https://api.notion.com/v1/blocks/')) {
    return new Response(JSON.stringify({ results: [{ type: 'paragraph', paragraph: { rich_text: [{ plain_text: 'LONG-READ-BODY-BLOCK' }] } }], has_more: false, next_cursor: null }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return orig(url, init);
};
