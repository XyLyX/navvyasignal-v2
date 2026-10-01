import { createHash } from 'node:crypto';
import { getStories } from '@/lib/notion';
export const dynamic = 'force-static';
export async function GET() {
 const stories = await getStories();
 const entries = stories.map(s => ({
  id: s.id,
  digest: createHash('sha256').update(JSON.stringify([
   s.title,s.brief,s.body,s.category,s.contentType,s.today,s.homepageDate,
   s.homepagePriority,s.watchlist,s.watchStatus,s.nextReview,s.createdAt,s.ready,s.coverageThemes
  ])).digest('hex')
 })).sort((a,b) => a.id.localeCompare(b.id));
 return Response.json({ version: 1, entries }, { headers: { 'Cache-Control': 'no-cache' } });
}
