import type { Story } from './notion';
import { dubaiPublicationDate } from './homepageSelection';

/**
 * V2 launch date, Dubai calendar. A Notion record's creation timestamp is NOT
 * its publication date. Only explicit editor-approved, dated Today selections
 * can enter the new V2 edition. Never migrate old Framer-synced material by age.
 */
export const V2_LAUNCH_DATE = '2026-09-25';

export function currentV2Stories(
  stories: Story[],
  approvedIds: readonly string[] = [],
  publicationDate = dubaiPublicationDate(),
): Story[] {
  const approved = new Set(approvedIds.map(id => id.trim().toLowerCase()).filter(Boolean));
  return stories.filter(s =>
    s.ready &&
    ((s.today && s.homepageDate !== null &&
      s.homepageDate >= V2_LAUNCH_DATE && s.homepageDate <= publicationDate) ||
      (approved.has(s.id.toLowerCase()) && s.homepageDate !== null &&
       s.homepageDate >= V2_LAUNCH_DATE && s.homepageDate <= publicationDate))
  ).sort((a,b) =>
    (b.homepageDate ?? '').localeCompare(a.homepageDate ?? '') ||
    (a.homepagePriority ?? Number.POSITIVE_INFINITY) - (b.homepagePriority ?? Number.POSITIVE_INFINITY) ||
    b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)
  );
}

/** Optional manual inclusion of dated, approved V2 stories; not required for daily publication. */
export function approvedV2Ids(): string[] {
  return (process.env.V2_CURRENT_STORY_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

/** Preserve approved Watchlist routes separately, including older ongoing stories. */
export function v2ArticleRoutes(stories: Story[], approvedIds: readonly string[]): Story[] {
  const selected = new Set(currentV2Stories(stories, approvedIds).map(s => s.id));
  return stories.filter(s => selected.has(s.id) || (s.ready && s.watchlist) ||
    (process.env.CI === 'true' && process.env.V2_CI_STATIC_FIXTURE === '1' && s.id === 'ci-static-fixture'));
}
