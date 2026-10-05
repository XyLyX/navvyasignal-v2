import {createHash, createHmac, timingSafeEqual} from 'node:crypto';
export const queueMarker = 'V2_UNVERIFIED_SIGNAL:';
export function passwordMatches(given:string, expected:string):boolean {
  return !!expected && timingSafeEqual(createHash('sha256').update(given).digest(),createHash('sha256').update(expected).digest());
}
export function issueSession(secret:string, now=Date.now()):string {
  const expiry=String(now+4*60*60*1000);
  return expiry+'.'+createHmac('sha256',secret).update('unverified:'+expiry).digest('hex');
}
export function sessionValid(value:string, secret:string, now=Date.now()):boolean {
  if(!secret||!/^\d{13}\.[a-f0-9]{64}$/.test(value))return false;
  const [expiry,signature]=value.split('.');
  if(Number(expiry)<=now||Number(expiry)>now+4*60*60*1000)return false;
  const expected=createHmac('sha256',secret).update('unverified:'+expiry).digest('hex');
  return timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex'));
}
export function escapeHtml(value:unknown):string {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
}
type Rich = {plain_text?:string;text?:{content?:string}};
export type QueuePage = {id:string;created_time:string;properties:Record<string,{title?:Rich[];rich_text?:Rich[];checkbox?:boolean;select?:{name:string}|null}>};
export function queueText(page:QueuePage,name:string):string { const p=page.properties[name];return (p?.title??p?.rich_text??[]).map(t=>t.plain_text??t.text?.content??'').join(''); }
export function isQueued(page:QueuePage):boolean {return page.properties['Ready to Post']?.checkbox===false&&queueText(page,'Internal Note').startsWith(queueMarker);}
export function sortedQueue(pages:QueuePage[]):QueuePage[]{return pages.filter(isQueued).sort((a,b)=>b.created_time.localeCompare(a.created_time)||b.id.localeCompare(a.id));}
