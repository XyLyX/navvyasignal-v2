import type { Config } from '@netlify/functions';
import { loadAllFeeds } from '../../src/lib/rss/service.ts';
import { NAVYAA_COUNT, NETWORK_PER_SOURCE } from '../../src/lib/rss/limits.ts';
import { FEED_REFRESH_MS } from '../../src/lib/rss/live.ts';

/** Public, read-only endpoint. URLs are fixed by the allowlist, never request parameters. */
export function createFeedHandler(load = loadAllFeeds) {
 return async function publicationFeeds(request: Request) {
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET' } });
  if (new URL(request.url).search) return new Response('Query parameters are not supported', { status: 400 });
  const now = new Date();
  // All six sources run concurrently; no model calls, credentials or article-page crawling.
  const results = (await load({ now, timeoutMs: 8_000 })).map(result => ({ ...result,
    items: result.items.slice(0, result.source.group === 'navyaa' ? NAVYAA_COUNT : NETWORK_PER_SOURCE) }));
  const failed = results.some(r => r.status === 'unavailable' || r.status === 'all-rejected');
  const data = { navyaa: results.find(r => r.source.group === 'navyaa'),
    network: results.filter(r => r.source.group === 'network'), retrievedAt: now.toISOString(), fixtureMode: false };
  return Response.json(data, { headers: {
    'Cache-Control': 'public, max-age=60, must-revalidate',
    'Netlify-CDN-Cache-Control': `public, durable, max-age=${failed ? 60 : FEED_REFRESH_MS / 1000}, must-revalidate`,
    'X-Content-Type-Options': 'nosniff',
  } });
 };
}

export default createFeedHandler();

export const config: Config = { path: '/api/publication-feeds' };
