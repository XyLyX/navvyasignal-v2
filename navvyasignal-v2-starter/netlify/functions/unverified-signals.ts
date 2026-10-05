import type {Config,Context} from '@netlify/functions';
import {passwordMatches,issueSession,sessionValid,escapeHtml as e,queueText,sortedQueue,type QueuePage,validQueueOrigin,isQueued} from '../../src/lib/unverified-access.ts';
function document(body:string):string {return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Unverified Signals | NavvyaSignal</title><style>body{margin:0;background:#f5f1ea;color:#0b1b2b;font:17px/1.65 Georgia,serif}main{max-width:900px;margin:40px auto;padding:0 24px}a{color:#0b1b2b}.home-button{display:inline-block;padding:10px 18px;border:1px solid #0b1b2b;border-radius:4px;text-decoration:none;font:16px system-ui}.home-button:hover{background:#0b1b2b;color:white}h1{font-size:36px}article{padding:24px 0;border-top:1px solid #b9b4aa}h2{font-size:25px;line-height:1.35}.copy{white-space:pre-wrap;overflow-wrap:anywhere}.meta{font:14px/1.6 system-ui;color:#535c64}textarea{width:100%;box-sizing:border-box;min-height:180px;font:16px/1.6 system-ui;padding:12px}button,input{font:16px system-ui;padding:12px;border:1px solid #777;border-radius:4px}button{background:#0b1b2b;color:white;cursor:pointer}label{display:block;margin:20px 0 6px}summary{cursor:pointer;font-weight:bold}header{display:flex;justify-content:space-between;gap:20px;align-items:center}strong.warning{display:block;margin:16px 0}input{max-width:100%;box-sizing:border-box}</style></head><body><main>${body}</main></body></html>`;}
function response(body:string,status=200,cookie?:string):Response {
  const headers:Record<string,string>={'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noarchive','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"};
  if(cookie)headers['Set-Cookie']=cookie;
  return new Response(document(body),{status,headers});
}
function login(message=''):Response {return response(`<a class="home-button" href="/">← Home</a><h1>Unverified Signals</h1><p>Private editorial review. These drafts are not approved reporting.</p>${message?`<p role="alert">${e(message)}</p>`:''}<form method="post" action="/unverified-signals"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256"><button type="submit">Open review queue</button></form>`);}
type Draft = QueuePage & {last_edited_time:string;parent?:{data_source_id?:string;database_id?:string};in_trash?:boolean;archived?:boolean};
function rich(text:string){return text.match(/[\s\S]{1,1900}/g)?.map(content=>({type:'text',text:{content}}))||[];}
async function notion(path:string,token:string,method='GET',body?:unknown){return fetch('https://api.notion.com/v1'+path,{method,headers:{Authorization:'Bearer '+token,'Notion-Version':'2025-09-03','Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});}
async function readDraft(id:string,token:string,source:string):Promise<Draft>{
 if(!/^[a-f0-9-]{32,36}$/i.test(id))throw Error('Invalid ID');
 const res=await notion('/pages/'+id,token);if(!res.ok)throw Error('Read failed');
 const page=await res.json() as Draft;
 if(!isQueued(page)||page.in_trash||page.archived||page.parent?.data_source_id?.replace(/-/g,'')!==source.replace(/-/g,''))throw Error('Not a queued draft in Signal Feed');
 return page;
}
function suggestion(note:string):string {
 if(/source|URL/i.test(note))return 'Add accessible direct source URLs and check every material claim against those sources.';
 if(/desk|classification/i.test(note))return 'Confirm the primary desk in Notion before approving publication.';
 if(/malformed|unparsed|JSON/i.test(note))return 'Reconstruct one complete signal from the retained raw draft; confirm its desk, sources and claims. Do not publish raw model output.';
 if(/provider|quota|credit|unavailable/i.test(note))return 'Automatic verification did not complete. Manually verify dates, figures and claims against the cited sources.';
 return 'Check each disputed claim against dated primary evidence. Correct or remove unsupported statements, then record how you resolved the findings.';
}
function detail(page:Draft):string {
 const note=queueText(page,'Internal Note').replace(/^V2_UNVERIFIED_SIGNAL:[a-f0-9]+\n/,'');
 return `<header><a class="home-button" href="/">← Home</a><a href="/unverified-signals">← Queue</a></header><h1>${e(queueText(page,'Name'))}</h1><p>${e(page.properties.Category?.select?.name||'Desk requires confirmation')}</p><h2>Reason for review</h2><div class="copy">${e(note)}</div><h2>Suggested action</h2><p>${e(suggestion(note))}</p><p><a href="https://www.notion.so/${page.id.replace(/-/g,'')}" target="_blank" rel="noopener noreferrer">Open full draft and retained original in Notion ↗</a></p><form method="post" action="/unverified-signals"><input type="hidden" name="id" value="${e(page.id)}"><input type="hidden" name="version" value="${e(page.last_edited_time)}"><label>Headline<input name="title" value="${e(queueText(page,'Name'))}" maxlength="300" required></label><label>Signal Brief<textarea name="brief" maxlength="1800" required>${e(queueText(page,'Signal Brief'))}</textarea></label><label>Public sources<textarea name="sources" maxlength="6000">${e(queueText(page,'Text 1'))}</textarea></label><label>Resolution / review note<textarea name="resolution" maxlength="1500"></textarea></label><label><input type="checkbox" name="reviewed" value="yes"> I have checked the sources and resolved the concerns. I approve publication.</label><button name="action" value="draft">Save as draft</button> <button name="action" value="publish">Save and approve for live</button></form><form method="post" action="/unverified-signals"><input type="hidden" name="id" value="${e(page.id)}"><input type="hidden" name="version" value="${e(page.last_edited_time)}"><label><input type="checkbox" name="confirm_delete" value="yes" required> Move this draft to Notion trash</label><button name="action" value="delete">Delete draft</button></form>`;
}
export default async (req:Request, context?:Pick<Context,'site'>) => {
  const password=Netlify.env.get('V2_UNVERIFIED_PASSWORD')||'';
  const token=(Netlify.env.get('NOTION_TOKEN')||Netlify.env.get('NOTION_API_KEY')||'').trim();
  const source=(Netlify.env.get('NOTION_DATA_SOURCE_ID')||'').trim();
  if(!password||!token||!source)return response('<h1>Unverified Signals</h1><p>Private review is not configured. Access remains locked.</p>',503);
  // Strong server-only Notion credential signs sessions; it is never returned to the browser.
  const secret=token+'\0'+password;
  const cookie=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('ns_unverified='))?.slice('ns_unverified='.length)||'';
  const authorized=sessionValid(cookie,secret);
  if(req.method==='POST'){
    if(!validQueueOrigin(req.headers.get('origin'),req.url,context?.site.url))return response('<a class="home-button" href="/">← Home</a><p>Invalid request origin. Open this page directly on navvyasignal.com and try again.</p>',403);
    if(Number(req.headers.get('content-length')||0)>64000)return response('<p>Request too large.</p>',413);
    const body=await req.text();if(body.length>64000)return response('<p>Request too large.</p>',413);
    const form=new URLSearchParams(body);
    if(form.get('action')==='logout')return new Response(null,{status:303,headers:{Location:'/unverified-signals','Cache-Control':'no-store','Set-Cookie':'ns_unverified=; Path=/unverified-signals; HttpOnly; Secure; SameSite=Strict; Max-Age=0'}});
    const action=form.get('action');
    if(action && ['draft','publish','delete'].includes(action)) {
      if(!authorized)return response('<p>Session expired. Sign in again.</p>',401);
      try {
        const id=form.get('id')||'';
        const page=await readDraft(id,token,source);
        if(page.last_edited_time!==form.get('version'))return response('<p>This draft changed since you opened it. Reopen it before saving.</p><a href="/unverified-signals">Back to queue</a>',409);
        let payload:Record<string,unknown>;
        if(action==='delete') {
          if(form.get('confirm_delete')!=='yes')return response('<p>Confirm deletion before continuing.</p>',400);
          payload={in_trash:true};
        } else {
          const title=(form.get('title')||'').trim(), brief=(form.get('brief')||'').trim(), sources=(form.get('sources')||'').trim();
          if(!title||title.length>300||!brief||brief.length>1800||sources.length>6000)return response('<p>Title is required (maximum 300 characters), brief is required (maximum 1,800 characters), sources maximum 6,000 characters.</p>',400);
          if(action==='publish' && (form.get('reviewed')!=='yes'||!(form.get('resolution')||'').trim()||!sources.match(/https:\/\/[^\s]+/)||!page.properties.Category?.select?.name||title.startsWith('Unparsed draft')))return response('<p>Publication requires a resolved review note, your confirmation, a confirmed desk, a proper headline and direct source URLs.</p>',400);
          const note=queueText(page,'Internal Note')+'\n\nManual review '+new Date().toISOString()+': '+(form.get('resolution')||'Draft edited; verification pending.');
          payload={properties:{Name:{title:rich(title)},'Signal Brief':{rich_text:rich(brief)},'Text 1':{rich_text:rich(sources)},'Internal Note':{rich_text:rich(note)},'Ready to Post':{checkbox:action==='publish'}}};
        }
        const saved=await notion('/pages/'+id,token,'PATCH',payload);
        if(!saved.ok)throw Error('Save failed');
        return new Response(null,{status:303,headers:{Location:'/unverified-signals?notice='+action,'Cache-Control':'no-store'}});
      } catch {return response('<a class="home-button" href="/">← Home</a><p>Could not save this draft. Reopen the queue and check its saved state before trying again.</p>',502);}
    }
    if(!passwordMatches(form.get('password')||'',password))return login('Incorrect password.');
    return new Response(null,{status:303,headers:{Location:'/unverified-signals','Cache-Control':'no-store','Set-Cookie':`ns_unverified=${issueSession(secret)}; Path=/unverified-signals; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`}});
  }
  if(req.method!=='GET')return response('<p>Method not allowed.</p>',405);
  if(!authorized)return login();
  const detailId=new URL(req.url).searchParams.get('id');
  if(detailId){try{return response(detail(await readDraft(detailId,token,source)));}catch{return response('<a href="/unverified-signals">← Queue</a><p>Draft unavailable or no longer awaiting review.</p>',404);}}
  const cursor=new URL(req.url).searchParams.get('cursor');
  if(cursor&&!/^[a-zA-Z0-9-]{1,100}$/.test(cursor))return response('<p>Invalid page cursor.</p>',400);
  try{
    const res=await fetch(`https://api.notion.com/v1/data_sources/${source}/query`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Notion-Version':'2025-09-03','Content-Type':'application/json'},body:JSON.stringify({page_size:50,filter:{and:[{property:'Ready to Post',checkbox:{equals:false}},{property:'Internal Note',rich_text:{starts_with:'V2_UNVERIFIED_SIGNAL:'}}]},sorts:[{timestamp:'created_time',direction:'descending'}],...(cursor?{start_cursor:cursor}:{})}),signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw new Error('Queue read failed');
    const data=await res.json() as {results:QueuePage[];has_more:boolean;next_cursor:string|null};
    const stories=sortedQueue(data.results);
    const notice=new URL(req.url).searchParams.get('notice');
    const message=notice==='publish'?'Approved for publication. The normal content checker will request a site refresh.':notice==='draft'?'Draft saved privately.':notice==='delete'?'Draft moved to Notion trash.':'';
    const items=stories.map(page=>`<article><p class="meta">${e(page.properties.Category?.select?.name||'Desk requires confirmation')} · ${e(new Date(page.created_time).toLocaleString('en-GB',{timeZone:'Asia/Dubai'}))} GST</p><h2><a href="/unverified-signals?id=${encodeURIComponent(page.id)}">${e(queueText(page,'Name'))}</a></h2></article>`).join('');
    return response(`<header><a class="home-button" href="/">← Home</a><form method="post" action="/unverified-signals"><input type="hidden" name="action" value="logout"><button>Lock page</button></form></header><h1>Unverified Signals</h1>${message?`<p role="status">${e(message)}</p>`:''}<strong class="warning">Private drafts — not verified or approved for publication.</strong><p>Newest first. Open a headline to review, edit, approve or delete the draft. Approved drafts publish through the normal site refresh; they are not labelled AI-cleared.</p>${items||'<p>No unverified drafts awaiting review.</p>'}${data.has_more&&data.next_cursor?`<p><a href="/unverified-signals?cursor=${encodeURIComponent(data.next_cursor)}">Older unverified signals →</a></p>`:''}`);
  }catch{return response('<h1>Unverified Signals</h1><p>The private queue could not be loaded. Please try again. No drafts have been changed.</p>',502);}
};
export const config:Config={path:['/unverified-signals','/unverified-signals/']};
