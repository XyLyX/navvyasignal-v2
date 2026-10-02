import type {Config,Context} from '@netlify/functions';
import {schedulerActive} from '../../src/lib/editorial-scheduler.ts';
export default async (_req:Request,context:Context) => {
  const active = context.deploy.context === 'production' &&
    !!Netlify.env.get('V2_GITHUB_ACTIONS_TOKEN')?.trim() &&
    schedulerActive(Netlify.env.get('V2_SCHEDULER_MODE'),Netlify.env.get('V2_SCHEDULER_START_AT'),new Date());
  return Response.json({version:1,active},{headers:{'Cache-Control':'no-store'}});
};
export const config:Config = {path:'/api/scheduler-status'};

