import test from 'node:test';
import assert from 'node:assert/strict';
import {dueJobs,dispatchOnce,schedulerActive,slots} from '../src/lib/editorial-scheduler.ts';
test('all seven agreed desk times convert correctly from GST',()=>{
  assert.deepEqual(slots().slice(0,7).map(s=>[s.runType,(s.utcHour+4)%24,s.minute]),[
    ['technology_ai',3,30],['maritime_energy',4,30],['markets_capital',5,30],
    ['west_asia',7,30],['global_politics',8,30],['uae',13,30],['india',17,30]]);
});
test('Dubai date crosses UTC midnight and weekly synthesis stays Sunday',()=>{
  const tech=dueJobs(new Date('2026-10-02T23:35:00Z'),'2026-10-02T00:00:00Z');
  assert.equal(tech.find(j=>j.runType==='technology_ai')?.editionDate,'2026-10-03');
  assert.ok(dueJobs(new Date('2026-10-04T15:15:00Z'),'2026-10-02T00:00:00Z').some(j=>j.runType==='weekly_synthesis'));
  assert.equal(dueJobs(new Date('2026-10-05T15:15:00Z'),'2026-10-02T00:00:00Z').length,0);
});
test('start boundary and catch-up window prevent replaying old research',()=>{
  assert.deepEqual(dueJobs(new Date('2026-10-02T13:35:00Z'),'2026-10-02T13:31:00Z'),[]);
  assert.deepEqual(dueJobs(new Date('2026-10-02T13:40:00Z'),'2026-10-02T00:00:00Z'),[]);
  assert.equal(schedulerActive('live','bad',new Date()),false);
  assert.equal(schedulerActive('probe','2026-01-01',new Date()),false);
});
function memory() {
 const data=new Map<string,string>();
 return {data,async set(key:string,value:string,opt?:{onlyIfNew:boolean}){
   if(opt?.onlyIfNew&&data.has(key))return {modified:false};data.set(key,value);return {modified:true};
 },async get(key:string){return data.get(key)||null}};
}
test('simultaneous invocations dispatch once with explicit edition date',async()=>{
 const store=memory(),job=dueJobs(new Date('2026-10-02T17:30:00Z'),'2026-10-02T00:00:00Z')[0];
 let calls=0;
 const fetcher=(async(_url,options)=>{calls++;const body=JSON.parse(String(options?.body));
 assert.equal(body.inputs.edition_date,'2026-10-02');assert.equal(body.ref,'main');
 return new Response(null,{status:204});}) as typeof fetch;
 const results=await Promise.all([dispatchOnce(job,'fake',store,fetcher),dispatchOnce(job,'fake',store,fetcher)]);
 assert.equal(calls,1);assert.deepEqual(results.sort(),['accepted','duplicate']);
});
test('ambiguous network failure keeps the claim and prevents paid retry',async()=>{
 const store=memory(),job=dueJobs(new Date('2026-10-02T13:30:00Z'),'2026-10-02T00:00:00Z')[0];
 let calls=0;const fetcher=(async()=>{calls++;throw new Error('timeout');}) as typeof fetch;
 await assert.rejects(dispatchOnce(job,'fake',store,fetcher),/timeout/);
 assert.equal(await dispatchOnce(job,'fake',store,fetcher),'duplicate');assert.equal(calls,1);
});
test('GitHub rejection throws and persists a diagnostic status without token',async()=>{
 const store=memory(),job=dueJobs(new Date('2026-10-02T13:30:00Z'),'2026-10-02T00:00:00Z')[0];
 await assert.rejects(dispatchOnce(job,'fake',store,(async()=>new Response(null,{status:403})) as typeof fetch),/403/);
 assert.equal(JSON.parse(store.data.get(job.key)!).status,403);
});

