import test from 'node:test';
import assert from 'node:assert/strict';
import {dueJobs,dispatchOnce,schedulerActive,slots} from '../src/lib/editorial-scheduler.ts';
test('four regional desks, editorial preparation, one release and one send at exact Dubai times',()=>{
 assert.deepEqual(slots().map(s=>[s.runType,(s.utcHour+4)%24,s.minute]),[
 ['north_america',2,30],['europe',4,0],['india_subcontinent',5,30],['uae_middle_east',7,0],['editorial_formats',8,0],['daily_release',9,0],['compile_send',10,0]]);
});
test('North America crosses UTC day with correct Dubai edition and no half-hour refresh',()=>{
 const jobs=dueJobs(new Date('2026-10-02T22:35:00Z'),'2026-10-02T00:00:00Z');
 assert.equal(jobs.length,1);assert.equal(jobs[0].editionDate,'2026-10-03');
 assert.equal(jobs[0].runType,'north_america');assert.match(jobs[0].key,/^regional-v1\//);
 assert.deepEqual(dueJobs(new Date('2026-10-04T15:15:00Z'),'2026-10-02T00:00:00Z'),[]);
 const release=dueJobs(new Date('2026-10-04T05:00:00Z'),'2026-10-02T00:00:00Z')[0];
 assert.equal(release.workflow,'v2-daily-release.yml');
 const send=dueJobs(new Date('2026-10-04T06:00:00Z'),'2026-10-02T00:00:00Z')[0];
 assert.equal(send.workflow,'v2-daily-send.yml');
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
 const store=memory(),job=dueJobs(new Date('2026-10-02T05:00:00Z'),'2026-10-02T00:00:00Z')[0];
 let calls=0;
 const fetcher=(async(_url,options)=>{calls++;const body=JSON.parse(String(options?.body));
 assert.equal(body.inputs.edition_date,'2026-10-02');assert.equal(body.ref,'main');
 return new Response(null,{status:204});}) as typeof fetch;
 const results=await Promise.all([dispatchOnce(job,'fake',store,fetcher),dispatchOnce(job,'fake',store,fetcher)]);
 assert.equal(calls,1);assert.deepEqual(results.sort(),['accepted','duplicate']);
});
test('ambiguous network failure keeps the claim and prevents paid retry',async()=>{
 const store=memory(),job=dueJobs(new Date('2026-10-02T03:00:00Z'),'2026-10-02T00:00:00Z')[0];
 let calls=0;const fetcher=(async()=>{calls++;throw new Error('timeout');}) as typeof fetch;
 await assert.rejects(dispatchOnce(job,'fake',store,fetcher),/timeout/);
 assert.equal(await dispatchOnce(job,'fake',store,fetcher),'duplicate');assert.equal(calls,1);
});
test('GitHub rejection throws and persists a diagnostic status without token',async()=>{
 const store=memory(),job=dueJobs(new Date('2026-10-02T03:00:00Z'),'2026-10-02T00:00:00Z')[0];
 await assert.rejects(dispatchOnce(job,'fake',store,(async()=>new Response(null,{status:403})) as typeof fetch),/403/);
 assert.equal(JSON.parse(store.data.get(job.key)!).status,403);
});


test('08:00 editorial preparation is distinct from desks, build and send',async()=>{
 const job=dueJobs(new Date('2026-10-19T04:05:00Z'),'2026-10-01T00:00:00Z')[0];
 assert.equal(job.runType,'editorial_formats');assert.equal(job.workflow,'v2-editorial-formats.yml');
 await dispatchOnce(job,'fake',memory(),(async(_url,options)=>{
  const body=JSON.parse(String(options?.body));
  assert.deepEqual(body.inputs,{dry_run:'false',edition_date:'2026-10-19'});
  return new Response(null,{status:204});
 }) as typeof fetch);
});
