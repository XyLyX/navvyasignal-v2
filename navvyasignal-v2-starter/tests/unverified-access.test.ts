import test from 'node:test';
import assert from 'node:assert/strict';
import {passwordMatches,issueSession,sessionValid,escapeHtml,sortedQueue,type QueuePage,validQueueOrigin} from '../src/lib/unverified-access.ts';
import handler from '../netlify/functions/unverified-signals.ts';
test('password comparison rejects wrong and unconfigured passwords',()=>{assert.ok(passwordMatches('demo','demo'));assert.equal(passwordMatches('wrong','demo'),false);assert.equal(passwordMatches('',''),false)});
test('sessions reject tampering expiry and other signing secrets',()=>{const now=1700000000000;const cookie=issueSession('secret',now);assert.ok(sessionValid(cookie,'secret',now));assert.equal(sessionValid(cookie,'other',now),false);assert.equal(sessionValid(cookie,'secret',now+14400001),false);assert.equal(sessionValid(cookie+'x','secret',now),false)});
test('HTML escapes untrusted draft text',()=>{assert.equal(escapeHtml('<script>"&'), '&lt;script&gt;&quot;&amp;')});
function page(id:string,created_time:string,ready=false,note='V2_UNVERIFIED_SIGNAL:abc'):QueuePage{return {id,created_time,properties:{'Ready to Post':{checkbox:ready},'Internal Note':{rich_text:[{plain_text:note}]}}}}
test('queue excludes approved entries and ordinary drafts and sorts recency',()=>{assert.deepEqual(sortedQueue([page('old','2026-01-01'),page('public','2026-01-04',true),page('draft','2026-01-03',false,'ordinary'),page('new','2026-01-02')]).map(p=>p.id),['new','old'])});
function environment(values:Record<string,string>){Object.assign(globalThis,{Netlify:{env:{get:(key:string)=>values[key]}}});}
test('unauthenticated requests never fetch or expose drafts',async()=>{environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});const original=globalThis.fetch;let fetched=false;globalThis.fetch=async()=>{fetched=true;throw Error('must not fetch')};try{const response=await handler(new Request('https://example.com/unverified-signals'));assert.equal(response.status,200);assert.match(await response.text(),/type="password"/);assert.equal(fetched,false);assert.match(response.headers.get('Cache-Control')!,/no-store/)}finally{globalThis.fetch=original}});
test('missing configuration fails closed',async()=>{environment({});const response=await handler(new Request('https://example.com/unverified-signals'));assert.equal(response.status,503)});
test('login rejects cross-origin requests and wrong passwords',async()=>{environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});const cross=await handler(new Request('https://example.com/unverified-signals',{method:'POST',headers:{Origin:'https://evil.example'},body:'password=demo'}));assert.equal(cross.status,403);const wrong=await handler(new Request('https://example.com/unverified-signals',{method:'POST',headers:{Origin:'https://example.com'},body:'password=wrong'}));assert.equal(wrong.headers.get('Set-Cookie'),null)});
test('login issues secure HttpOnly session and logout clears it',async()=>{environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});const login=await handler(new Request('https://example.com/unverified-signals',{method:'POST',headers:{Origin:'https://example.com'},body:'password=demo'}));assert.equal(login.status,303);assert.match(login.headers.get('Set-Cookie')!,/HttpOnly; Secure; SameSite=Strict/);const logout=await handler(new Request('https://example.com/unverified-signals',{method:'POST',headers:{Origin:'https://example.com'},body:'action=logout'}));assert.match(logout.headers.get('Set-Cookie')!,/Max-Age=0/)});
test('authorized listing requests only marked unapproved records',async()=>{environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});const original=globalThis.fetch;let query:any;globalThis.fetch=async(_url,init)=>{query=JSON.parse(String(init?.body));return Response.json({results:[page('abc','2026-01-01')],has_more:false,next_cursor:null})};try{const cookie=issueSession('token\0demo');const response=await handler(new Request('https://example.com/unverified-signals',{headers:{Cookie:'ns_unverified='+cookie}}));assert.equal(response.status,200);assert.equal(query.filter.and[0].checkbox.equals,false);assert.equal(query.sorts[0].direction,'descending');assert.match(await response.text(),/Private drafts/)}finally{globalThis.fetch=original}});

test('origin check supports canonical and www aliases after Netlify normalization',()=>{
 assert.ok(validQueueOrigin('https://www.navvyasignal.com','https://navvyasignal.com/unverified-signals'));
 assert.ok(validQueueOrigin('https://navvyasignal.com','https://internal.netlify/unverified-signals'));
 assert.equal(validQueueOrigin('https://evil.example','https://navvyasignal.com/unverified-signals'),false);
 assert.equal(validQueueOrigin(null,'https://navvyasignal.com/unverified-signals'),false);
 assert.equal(validQueueOrigin('https://navvyasignal.com.evil.example','https://navvyasignal.com/unverified-signals'),false);
});
test('www alias login succeeds and both views have Home buttons',async()=>{
 environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});
 const page=await handler(new Request('https://navvyasignal.com/unverified-signals'));
 assert.match(await page.text(),/class="home-button" href="\/">← Home/);
 const login=await handler(new Request('https://navvyasignal.com/unverified-signals',{method:'POST',headers:{Origin:'https://www.navvyasignal.com'},body:'password=demo'}));
 assert.equal(login.status,303);
});

test('form preserves same-origin Origin header instead of browser null origin',async()=>{
 environment({V2_UNVERIFIED_PASSWORD:'demo',NOTION_TOKEN:'token',NOTION_DATA_SOURCE_ID:'source'});
 const response=await handler(new Request('https://navvyasignal.com/unverified-signals'));
 assert.equal(response.headers.get('Referrer-Policy'),'same-origin');
 assert.equal(validQueueOrigin('null','https://navvyasignal.com/unverified-signals'),false);
});
