import {getInsights,makeRss} from '@/lib/insights';
export const dynamic='force-static';
export async function GET(){return new Response(makeRss(await getInsights(),'world-ahead'),{headers:{'Content-Type':'application/rss+xml; charset=utf-8'}});}
