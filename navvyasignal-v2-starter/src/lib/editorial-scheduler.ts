export type Slot = { runType: string; utcHour: number; minute: number; weekday?: number };
export function slots(): Slot[] {
  return [
    {runType:'technology_ai',utcHour:23,minute:30},
    {runType:'maritime_energy',utcHour:0,minute:30},
    {runType:'markets_capital',utcHour:1,minute:30},
    {runType:'west_asia',utcHour:3,minute:30},
    {runType:'global_politics',utcHour:4,minute:30},
    {runType:'uae',utcHour:9,minute:30},
    {runType:'india',utcHour:13,minute:30},
    {runType:'site_only',utcHour:17,minute:30},
    {runType:'weekly_synthesis',utcHour:15,minute:15,weekday:0},
  ];
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
      if (slot.weekday !== undefined && due.getUTCDay() !== slot.weekday) continue;
      const age = now.getTime()-due.getTime();
      if (due.getTime()<start || age<0 || age>=600000) continue;
      const editionDate = new Date(due.getTime()+4*3600000).toISOString().slice(0,10);
      jobs.push({key:editionDate+'/'+slot.runType,runType:slot.runType,editionDate,
        workflow:'v2-editorial-pipeline.yml',dueAt:due.toISOString()});
    }
  }
  // Content comparison is cheap and triggers a build only when approved content changes.
  const due = new Date(now);
  due.setUTCMinutes(now.getUTCMinutes()<30?0:30,0,0);
  if (due.getTime()>=start && now.getTime()-due.getTime()<600000) {
    jobs.push({key:due.toISOString()+'/refresh',runType:'refresh',
      editionDate:new Date(due.getTime()+4*3600000).toISOString().slice(0,10),
      workflow:'v2-static-refresh.yml',dueAt:due.toISOString()});
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
  const inputs = job.runType==='probe' ? {} : job.runType==='refresh' ? {dry_run:'false'} :
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
