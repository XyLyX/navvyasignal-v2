import type {Config} from '@netlify/functions';
import {passwordMatches,issueSession,sessionValid,escapeHtml as e,queueText,sortedQueue,type QueuePage} from '../../src/lib/unverified-access.ts';
function document(body:string):string {return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Unverified Signals | NavvyaSignal</title><style>body{margin:0;background:#f5f1ea;color:#0b1b2b;font:17px/1.65 Georgia,serif}main{max-width:900px;margin:40px auto;padding:0 24px}a{color:#0b1b2b}h1{font-size:36px}article{padding:24px 0;border-top:1px solid #b9b4aa}h2{font-size:25px;line-height:1.35}.copy{white-space:pre-wrap;overflow-wrap:anywhere}.meta{font:14px/1.6 system-ui;color:#535c64}button,input{font:16px system-ui;padding:12px;border:1px solid #777;border-radius:4px}button{background:#0b1b2b;color:white;cursor:pointer}label{display:block;margin:20px 0 6px}summary{cursor:pointer;font-weight:bold}header{display:flex;justify-content:space-between;gap:20px;align-items:center}strong.warning{display:block;margin:16px 0}input{max-width:100%;box-sizing:border-box}</style></head><body><main>${body}</main></body></html>`;}
function response(body:string,status=200,cookie?:string):Response {
  const headers:Record<string,string>={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
  if(cookie)headers['Set-Cookie']=cookie;
  return new Response(document(body),{status,headers});
}
function login(message=''):Response {return response(`<a href="/">← NavvyaSignal</a><h1>Unverified Signals</h1><p>Private editorial review. These drafts are not approved reporting.</p>${message?`<p role="alert">${e(message)}</p>`:''}<form method="post" action="/unverified-signals"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Open review queue</button></form>`);}
export default async (req:Request) => {
  const password=Netlify.env.get('V2_UNVERIFIED_PASSWORD')||'';
  const token=(Netlify.env.get('NOTION_TOKEN')||Netlify.env.get('NOTION_API_KEY')||'').trim();
  const source=(Netlify.env.get('NOTION_DATA_SOURCE_ID')||'').trim();
  if(!password||!token||!source)return response('<h1>Unverified Signals</h1><p>Private review is not configured. Access remains locked.</p>',503);
  // Strong server-only Notion credential signs sessions; it is never returned to the browser.
  const secret=token+'\0'+password;
  const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ns_unverified='))?.slice('ns_unverified='.length)||'';
  const authorized=sessionValid(cookie,secret);
  if(req.method==='POST'){
    if(req.headers.get('origin')!==new URL(req.url).origin)return response('<p>Invalid request origin.</p>',403);
    if(Number(req.headers.get('content-length')||0)>4096)return response('<p>Request too large.</p>',413);
    const body=await req.text();if(body.length>4096)return response('<p>Request too large.</p>',413);
    const form=new URLSearchParams(body);
    if(form.get('action')==='logout')return new Response(null,{status:303,headers:{Location:'/unverified-signals','Cache-Control':'no-store','Set-Cookie':'ns_unverified=; Path=/unverified-signals; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
    if(!passwordMatches(form.get('password')||'',password))return login('Incorrect password.');
    return new Response(null,{status:303,headers:{Location:'/unverified-signals','Cache-Control':'no-store','Set-Cookie':`ns_unverified=${issueSession(secret)}; Path=/unverified-signals; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`}});
  }
  if(req.method!=='GET')return response('<p>Method not allowed.</p>',405);
  if(!authorized)return login();
  const cursor=new URL(req.url).searchParams.get('cursor');
  if(cursor&&!/^[a-zA-Z0-9-]{1,100}$/.test(cursor))return response('<p>Invalid page cursor.</p>',400);
  try{
    const res=await fetch(`https://api.notion.com/v1/data_sources/${source}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify({page_size:50,filter:{and:[{property:'Ready to Post',checkbox:{equals:false}},{property:'Internal Note',rich_text:{starts_with:'V2_UNVERIFIED_SIGNAL:'}}]},sorts:[{timestamp:'created_time',direction:'descending'}],...(cursor?{start_cursor:cursor}:{})}),signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error('Queue read failed');
    const data=await res.json() as {results:QueuePage[];has_more:boolean;next_cursor:string|null};
    const stories=sortedQueue(data.results);
    const items=stories.map(page=>`<article><p class="meta">${e(page.properties.Category?.select?.name||'Desk requires confirmation')} · ${e(new Date(page.created_time).toLocaleString('en-GB',{timeZone:'Asia/Dubai'}))} GST</p><h2>${e(queueText(page,'Name'))}</h2><div class="copy">${e(queueText(page,'Signal Brief'))}</div><details><summary>Sources and review findings</summary><h3>Sources</h3><div class="copy">${e(queueText(page,'Text 1'))}</div><h3>Review findings</h3><div class="copy">${e(queueText(page,'Internal Note').replace(/^V2_UNVERIFIED_SIGNAL:[a-f0-9]+\n/,''))}</div></details><p><a href="https://www.notion.so/${e(page.id.replace(/-/g,''))}" target="_blank" rel="noopener noreferrer">Open draft in Notion ↗</a></p></article>`).join('');
    return response(`<header><a href="/">← NavvyaSignal</a><form method="post" action="/unverified-signals"><input type="hidden" name="action" value="logout"><button>Lock page</button></form></header><h1>Unverified Signals</h1><strong class="warning">Private drafts — not verified or approved for publication.</strong><p>Newest first. Review and resolve each draft in Notion before approving it.</p>${items||'<p>No unverified drafts awaiting review.</p>'}${data.has_more&&data.next_cursor?`<p><a href="/unverified-signals?cursor=${encodeURIComponent(data.next_cursor)}">Older unverified signals →</a></p>`:''}`);
  }catch{return response('<h1>Unverified Signals</h1><p>The private queue could not be loaded. Please try again. No drafts have been changed.</p>',502);}
};
export const config:Config={path:['/unverified-signals','/unverified-signals/']};
