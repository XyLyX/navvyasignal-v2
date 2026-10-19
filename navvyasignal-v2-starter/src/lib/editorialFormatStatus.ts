import type {Story} from './notion';
export type EditorialKind = 'Cross-Desk'|'Briefing'|'Long Read';
export type EditorialAssessment = {
 format: EditorialKind; edition: string; periodStart: string; periodEnd: string;
 status: 'staged'|'held'|'no_connection'|'no_inputs'|'failed'; completedAt: string;
};
export const kinds: EditorialKind[] = ['Cross-Desk','Briefing','Long Read'];
const iso = (d:Date) => d.toISOString().slice(0,10);
const shift = (day:string,n:number) => {const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return iso(d)};
export function dubaiDay(now:Date):string {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(key:string)=>parts.find(p=>p.type===key)!.value;
 return get('year')+'-'+get('month')+'-'+get('day');
}
export function expectedWindow(kind:EditorialKind,now:Date) {
 const today=dubaiDay(now);
 const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Dubai',hour:'2-digit',hourCycle:'h23'}).format(now));
 const edition=hour<9?shift(today,-1):today;
 if(kind==='Cross-Desk')return {start:edition,end:edition,publishedSince:edition};
 const weekday=(new Date(edition+'T12:00:00Z').getUTCDay()+6)%7;
 const monday=shift(edition,-weekday);
 return {start:shift(monday,-7),end:shift(monday,-1),publishedSince:monday};
}
export function editorialState(kind:EditorialKind,story:Story|undefined,assessments:EditorialAssessment[],now:Date) {
 const window=expectedWindow(kind,now);
 const published=story?dubaiDay(new Date(story.createdAt)):null;
 let current=!!published&&published>=window.publishedSince&&published<=dubaiDay(now);
 if(current&&kind==='Briefing') {
  const period=story!.title.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
  if(period)current=period[1]===window.start&&period[2]===window.end;
 }
 const assessment=assessments.filter(a=>a.format===kind&&a.periodStart===window.start&&a.periodEnd===window.end)
  .sort((a,b)=>b.completedAt.localeCompare(a.completedAt))[0];
 let message='';
 if(!current) {
  if(assessment?.status==='no_connection')message=kind==='Cross-Desk'?'This edition was assessed; no publishable cross-desk connection was established.':'This edition was assessed; no sufficiently supported report was approved.';
  else if(assessment?.status==='held')message='The current report is awaiting editorial approval.';
  else if(assessment?.status==='no_inputs')message='No approved source reporting was available for the current edition.';
  else if(assessment?.status==='failed')message='The current edition is delayed.';
  else message='The current edition is pending.';
 }
 return {current,message,window};
}
