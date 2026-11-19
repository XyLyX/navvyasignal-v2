import {outlookPublicationEnabled} from '@/lib/strategicOutlookSeo';
export const dynamic='force-static';
export function GET(){if(!outlookPublicationEnabled())return new Response('Not found',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow, noarchive','Cache-Control':'no-store'}});return new Response('Not found',{status:404,headers:{'X-Robots-Tag':'noindex, nofollow'}});}
