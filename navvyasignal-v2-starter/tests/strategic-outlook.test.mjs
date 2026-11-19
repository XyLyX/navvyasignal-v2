import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const lib=read('../src/lib/strategicOutlook.ts');
const page=read('../src/app/strategic-outlook/page.tsx');
const section=read('../src/app/strategic-outlook/[slug]/page.tsx');
const insights=read('../src/app/insights/page.tsx');
const layout=read('../src/app/layout.tsx');
test('all ten section routes are declared exactly once',()=>{
 const slugs=[...lib.matchAll(/slug:'([^']+)'/g)].map(m=>m[1]);
 assert.deepEqual(slugs,['opening','part-01','part-02','part-03','part-04','part-05','part-06','part-07','part-08','closing']);
});
test('outlook preview is fail-closed and never enabled in production',()=>{
 assert.match(lib,/STRATEGIC_OUTLOOK_PRIVATE_PREVIEW/);
 assert.match(lib,/NEXT_PUBLIC_V2_PRODUCTION\s*!==\s*'true'/);
 assert.match(page,/if\(!outlookPreviewEnabled\(\)\) notFound\(\)/);
 assert.match(section,/if\(!outlookPreviewEnabled\(\)\) notFound\(\)/);
 assert.match(page,/index:false,follow:false/);
 assert.match(section,/index:false,follow:false/);
});
test('outlook route has no Notion or Signals dependency and no manuscript text',()=>{
 assert.doesNotMatch(lib+page+section,/from ['"][^'"]*(?:\/insights|\/notion|\/signals|\/feeds)['"]/);
 assert.doesNotMatch(lib+page+section,/getInsights\(|getSignals\(|NOTION_TOKEN/);
 assert.match(page,/metadata only/);
});
test('Insights page and global layout remain unchanged on this branch',()=>{
 assert.match(insights,/getInsights/);
 assert.match(layout,/href="\/insights"/);
});
