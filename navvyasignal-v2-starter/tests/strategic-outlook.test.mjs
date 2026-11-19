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
 assert.match(page,/robots:outlookNoIndex/);
 assert.match(section,/robots:outlookNoIndex/);
});
test('outlook route has no Notion or Signals dependency',()=>{
 assert.doesNotMatch(lib+page+section,/from ['"][^'"]*(?:\/insights|\/notion|\/signals|\/feeds)['"]/);
 assert.doesNotMatch(lib+page+section,/getInsights\(|getSignals\(|NOTION_TOKEN/);
 assert.match(section,/outlookManuscript\(section\)/);
});
test('Insights page and global layout remain unchanged on this branch',()=>{
 assert.match(insights,/getInsights/);
 assert.match(layout,/href="\/insights"/);
});

test('Outlook RSS, Atom and JSON Feed stay 404 while publication HOLD is active',()=>{
 const seo=read('../src/lib/strategicOutlookSeo.ts');
 assert.match(seo,/outlookPublicationEnabled=\(\)=>false/);
 for(const p of ['rss.xml','atom.xml','feed.json']){
  const route=read('../src/app/strategic-outlook/'+p+'/route.ts');
  assert.match(route,/outlookPublicationEnabled\(\)/);
  assert.match(route,/status:404/);
  assert.match(route,/noindex, nofollow/);
 }
});
test('Preview metadata contains unique titles and descriptions but no publishable structured data',()=>{
 assert.match(page,/outlookSeriesTitle/);
 assert.match(page,/outlookDescription/);
 assert.match(section,/description:section\?\.summary/);
 assert.doesNotMatch(page+section,/@context|application\/ld\+json/);
});
