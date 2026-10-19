import policy from './regional-policy.json' with {type:'json'};
export function releaseDate(now=new Date()):string {
 const local=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:string)=>local.find(p=>p.type===type)!.value;
 const date=`${part('year')}-${part('month')}-${part('day')}`;
 return Number(part('hour'))<9?date:new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10);
}
export function approvalNote(note:string,resolution:string,action:'now'|'scheduled',now=new Date()):string {
 const date=action==='scheduled'?releaseDate(now):new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dubai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const state=action==='scheduled'?{policy:policy.version,edition:date,approved:true,target:null}:{policy:policy.version,edition:date};
 const marker=action==='scheduled'?'V2_RELEASE_PENDING:':'V2_RELEASED:';
 return marker+JSON.stringify(state)+'\nManual approval '+now.toISOString()+': '+resolution+'\n'+note;
}
