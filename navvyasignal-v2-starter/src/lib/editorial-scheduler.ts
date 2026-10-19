import policy from './regional-policy.json' with {type:'json'};
export type Slot = { runType: string; utcHour: number; minute: number };
export function slots(): Slot[] {
  return [...policy.desks.map(d => ({runType:d.key,utcHour:d.utcHour,minute:d.minute})),
    {runType:'editorial_formats',...policy.editorial}, {runType:'daily_release',...policy.release}, {runType:'compile_send',...policy.send}];
}
export function schedulerActive(mode: string | undefined, startAt: string | undefined, now: Date) {
  const start = Date.parse(startAt || '');
  return mode === 'live' && Number.isFinite(start) && now.getTime() >= start;
}
export function dueJobs(now: Date, startAt: string) {
  const jobs: {key:string;runType:string;editionDate:string;workflow:string;dueAt:string}[] = [];
  const start = Date.parse(startAt);
  if (!Number.isFinite(start)) return jobs;
  // A ten-minute catch-up window tolerates brief timer delays without replaying old research.
  for (const dayOffset of [-1,0]) {
    const day = new Date(now); day.setUTCDate(day.getUTCDate()+dayOffset);
    for (const slot of slots()) {
      const due = new Date(day); due.setUTCHours(slot.utcHour,slot.minute,0,0);
      const age = now.getTime()-due.getTime();
      if (due.getTime()<start || age<0 || age>=600000) continue;
      const editionDate = new Date(due.getTime()+4*3600000).toISOString().slice(0,10);
      jobs.push({key:policy.version+'/'+editionDate+'/'+slot.runType,runType:slot.runType,editionDate,
        workflow:slot.runType==='editorial_formats'?'v2-editorial-formats.yml':slot.runType==='daily_release'?'v2-daily-release.yml':slot.runType==='compile_send'?'v2-daily-send.yml':'v2-editorial-pipeline.yml',dueAt:due.toISOString()});
    }
  }
  return jobs;
}
export async function dispatchOnce(job: ReturnType<typeof dueJobs>[number], token:string,
  store: {set:(key:string,value:string,options?:{onlyIfNew:boolean})=>Promise<{modified:boolean}>;
    get:(key:string)=>Promise<unknown>}, fetcher:typeof fetch=fetch) {
  const claim = await store.set(job.key,JSON.stringify({state:'claimed',dueAt:job.dueAt}),{onlyIfNew:true});
  if (!claim.modified) return 'duplicate';
  // Verify persistence before a paid run; storage failures must not silently lose the lock.
  if (!await store.get(job.key)) throw new Error('Scheduler claim could not be verified');
  const inputs = job.runType==='probe' ? {} : ['daily_release','compile_send','editorial_formats'].includes(job.runType) ? {dry_run:'false',edition_date:job.editionDate} :
    {run_type:job.runType,dry_run:'false',edition_date:job.editionDate,schedule_key:job.key};
  try {
    const response = await fetcher('https://api.github.com/repos/XyLyX/navvyasignal-v2/actions/workflows/'+job.workflow+'/dispatches',{
      method:'POST',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json',
        'X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      body:JSON.stringify({ref:'main',inputs}),signal:AbortSignal.timeout(8000)
    });
    if (response.status !== 204) {
      await store.set(job.key,JSON.stringify({state:'rejected',status:response.status,dueAt:job.dueAt}));
      throw new Error('GitHub dispatch rejected: HTTP '+response.status);
    }
    await store.set(job.key,JSON.stringify({state:'accepted',dueAt:job.dueAt}));
    return 'accepted';
  } catch (error) {
    // Keep the claim on ambiguous network failure. Automatic retries can duplicate paid research.
    throw error;
  }
}
