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

/** Frozen September 26 launch selection. Do not import the historical V1 corpus. */
export const V2_RELEASE_STORY_IDS = [
  '3e711486-b145-81d4-ab9b-df118d024af7',
  '3e711486-b145-8125-984f-e53f8161b738',
  '3e711486-b145-81d5-a3bd-c35b5f9f0ecb',
  '3e611486-b145-818c-9fc9-eb2a4e60859f',
  '3e711486-b145-81e1-9c53-d10eeacc0234',
  '3e711486-b145-81b1-b952-e65d90b99393',
  '3e711486-b145-8196-a590-cfd42b25193a',
  '3e711486-b145-8192-a6ab-f83c4d3f37ac',
  '3e711486-b145-81df-a214-ccbd9f8ea69c',
  '3e711486-b145-8143-82c8-dd233fab1ec9',
  '3e711486-b145-81ea-bce6-edf71b979c27',
  '3e711486-b145-81a9-9628-c66ba972bf28',
  '3e711486-b145-81f9-be65-dc1992564204',
  '3e711486-b145-81a4-8613-e6d9b2c6abb3',
  '3e711486-b145-81ae-9dc1-dd7fbfd1ea9a',
  '3e711486-b145-817b-b669-e2a73cd40836',
  '3e711486-b145-81f3-a6b9-e65e3678c45b',
  '3e711486-b145-81a7-9cd3-f2f6fa1ee168',
  '3e711486-b145-8135-8bb7-e2f7ad72d5cd',
  '3e711486-b145-81c6-83ee-dc0a67a502fd',
  '3e611486-b145-8117-94fe-cbd850bcb088',
  '3e611486-b145-819c-8bf9-c35ea0b4b43a',
  '3e611486-b145-8129-b172-c7f37f418efa',
  '3e611486-b145-8191-87e6-ef3c6b6e0cb1',
  '3e611486-b145-81a2-a79e-ddbb7c4857da',
  '3e611486-b145-81a4-8715-e120c45f3b57',
  '3e611486-b145-8176-b0d7-fc9f936d7abd',
  '3e611486-b145-810f-8247-db88c2d66076',
] as const;

/** Explicit launch selection; environment IDs may add subsequent editor-approved records. */
export function approvedV2Ids(): string[] {
  return [...new Set([...V2_RELEASE_STORY_IDS, ...(process.env.V2_CURRENT_STORY_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)])];
}

/** Preserve approved Watchlist routes separately, including older ongoing stories. */
export function v2ArticleRoutes(stories: Story[], approvedIds: readonly string[]): Story[] {
  const selected = new Set(currentV2Stories(stories, approvedIds).map(s => s.id));
  return stories.filter(s => selected.has(s.id) || (s.ready && s.watchlist) ||
    (process.env.CI === 'true' && process.env.V2_CI_STATIC_FIXTURE === '1' && s.id === 'ci-static-fixture'));
}
