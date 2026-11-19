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
test('outlook private preview and public edition use distinct build inputs',()=>{
 assert.match(lib,/STRATEGIC_OUTLOOK_PRIVATE_PREVIEW/);
 assert.match(lib,/NEXT_PUBLIC_V2_PRODUCTION\s*!==\s*'true'/);
 const publication=read('../src/lib/strategicOutlookPublication.ts');
 assert.match(publication,/STRATEGIC_OUTLOOK_APPROVED_EDITION/);
 assert.match(publication,/validateOutlookRelease\(manifest, read\)/);
 assert.match(page,/if\(!preview && !published.length\) notFound\(\)/);
 assert.match(section,/if \(!section \|\| \(!preview && !entry\)\) notFound\(\)/);
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

test('all public feeds and the sitemap consume the same validated edition',()=>{
 const publication=read('../src/lib/strategicOutlookPublication.ts');
 assert.match(publication,/if \(!entries.length\) return new Response\('Not found', \{status:404/);
 assert.match(publication,/noindex, nofollow/);
 for (const [file, format] of [['rss.xml','rss'],['atom.xml','atom'],['feed.json','json'],['sitemap.xml','sitemap']]) {
  const route=read('../src/app/strategic-outlook/'+file+'/route.ts');
  assert.ok(route.includes("outlookResponse('"+format+"')"));
 }
});
