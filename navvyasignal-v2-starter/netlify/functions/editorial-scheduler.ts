import type {Config,Context} from '@netlify/functions';
import {getStore} from '@netlify/blobs';
import {schedulerConfiguration} from '../../src/lib/scheduler-rollout.ts';
import {schedulerActive,dueJobs,dispatchOnce} from '../../src/lib/editorial-scheduler.ts';

export default async (_req:Request, context:Context) => {
  // Publish the scheduler credential and probe configuration with this deployment.
  const now = new Date();
  const {mode,startAt} = schedulerConfiguration(Netlify.env.get('V2_SCHEDULER_MODE'),Netlify.env.get('V2_SCHEDULER_START_AT'));
  if (context.deploy.context !== 'production') return;
  if (mode !== 'probe' && !schedulerActive(mode,startAt,now)) return;
  const token = Netlify.env.get('V2_GITHUB_ACTIONS_TOKEN')?.trim();
  if (!token) throw new Error('V2_GITHUB_ACTIONS_TOKEN is missing');
  const store = getStore({name:'v2-scheduler-dispatches',consistency:'strong'});
  const jobs = mode === 'probe' ? [{
    key:'connectivity-probe-restored-2026-10-02',runType:'probe',editionDate:now.toISOString().slice(0,10),
    workflow:'v2-scheduler-probe.yml',dueAt:now.toISOString()
  }] : dueJobs(now,startAt!);
  for (const job of jobs) {
    const result = await dispatchOnce(job,token,store);
    console.log(JSON.stringify({scheduler:result,key:job.key,dueAt:job.dueAt}));
  }
};
export const config:Config = {schedule:'*/5 * * * *'};
