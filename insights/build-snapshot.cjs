#!/usr/bin/env node
// Builds the Insights published snapshot from the dedicated Insights Notion data source.
// Default is a read-only dry run. NOT wired into any workflow, schedule or deployment.
//   node insights/build-snapshot.cjs                  report only
//   node insights/build-snapshot.cjs --write          write navvyasignal-v2-starter/src/data/published-insights.json
//   node insights/build-snapshot.cjs --reconcile      apply "return to In Review" for materially revised articles
//   node insights/build-snapshot.cjs --approve <id>   record the approval fingerprint for one article
// Output contains only page ids, slugs and reason codes. Never titles, bodies, notes, tokens.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const bridge = require('./notion-bridge.cjs');

const SNAPSHOT = path.join(__dirname, '..', 'navvyasignal-v2-starter', 'src', 'data', 'published-insights.json');

async function main(argv, env = process.env, log = console.log) {
  const write = argv.includes('--write');
  const reconcile = argv.includes('--reconcile');
  const approveIdx = argv.indexOf('--approve');
  const client = bridge.createClient({
    token: env.NOTION_API_KEY,
    dataSourceId: env.INSIGHTS_NOTION_DATA_SOURCE_ID || bridge.DEFAULT_INSIGHTS_DATA_SOURCE_ID
  });
  const records = await bridge.loadRecords(client);

  if (approveIdx !== -1) {
    const id = argv[approveIdx + 1];
    const rec = records.find((r) => r.id === id);
    if (!rec) throw new Error('Approve target not found in the Insights data source');
    const out = await bridge.approveRevision(rec, { patchPage: client.patchPage });
    log(JSON.stringify({ approve: { id, approved: out.approved, reasons: out.reasons || [] } }));
    return out.approved ? 0 : 2;
  }

  const actions = await bridge.reconcileRevisions(records, { patchPage: client.patchPage, apply: reconcile });
  const { articles, excluded } = bridge.buildSnapshot(records.filter((r) => !actions.some((a) => a.id === r.id)));
  log(JSON.stringify({ eligible: articles.map((a) => a.slug), excluded, revisions: actions }));

  if (write) {
    const next = bridge.serializeSnapshot(articles);
    const current = fs.existsSync(SNAPSHOT) ? fs.readFileSync(SNAPSHOT, 'utf8') : '';
    if (next !== current) fs.writeFileSync(SNAPSHOT, next);
    log(JSON.stringify({ snapshotWritten: next !== current, articles: articles.length }));
  }
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => process.exit(code), (e) => { console.error(`Insights bridge failed: ${e.message}`); process.exit(1); });
}
module.exports = { main };
