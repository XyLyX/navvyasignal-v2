import type { Story } from './notion';

export const HOMEPAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Creation time is conservative: edits and reselection never make an old report fresh. */
export function isHomepageFresh(story: Story, now: number): boolean {
  const created = Date.parse(story.createdAt);
  return story.ready && Number.isFinite(created) && created <= now && now - created < HOMEPAGE_MAX_AGE_MS;
}

/** All candidates passed editorial approval; freshness outranks yesterday's homepage priority. */
export function selectFreshIntelligence(stories: Story[], now: number, limit = 7): Story[] {
  return stories.filter(s => isHomepageFresh(s, now) && (!s.contentType || s.contentType === 'Signal'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit));
}
