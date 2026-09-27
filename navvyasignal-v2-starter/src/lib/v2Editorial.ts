import type { Story } from './notion';
import { dubaiPublicationDate } from './homepageSelection';

/**
 * Publication vs homepage selection.
 *
 * PUBLICATION: every approved story (`Ready to Post`) that belongs to the V2 era is published to its
 * desk page, the Signals archive and its own /signals/<id> route, whether or not it carries any
 * homepage metadata.
 *
 * HOMEPAGE: `selectHomepageEdition` (homepageSelection.ts) alone controls the curated homepage.
 *
 * TEMPORARY MIGRATION BOUNDARY ("V2 era" guard): the database still holds the historical Framer-era corpus,
 * all approved, and a record's creation timestamp is not its publication date. Until that corpus is audited
 * and its home (V1 archive vs V2) is decided, a story is published only if it was created on/after the
 * publication start date (Dubai calendar), OR carries a Homepage Date on/after it, OR is listed in
 * V2_CURRENT_STORY_IDS. Lower or disable it deliberately via V2_PUBLICATION_START once that decision is made;
 * see docs/homepage-editorial-contract.md ("Publication cutoff") for the removal criteria.
 */
export const V2_LAUNCH_DATE = '2026-09-25';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
type Env = Record<string, string | undefined>;

/** Default is the V2 launch date. `V2_PUBLICATION_START=YYYY-MM-DD` moves it (e.g. 1970-01-01 to disable the guard). */
export function publicationStartDate(env: Env = process.env): string {
  const value = (env.V2_PUBLICATION_START ?? '').trim();
  return ISO_DATE.test(value) ? value : V2_LAUNCH_DATE;
}

/**
 * V2_CURRENT_STORY_IDS: comma-separated Notion page IDs. ADDITIVE EXCEPTION ONLY: it publishes specific
 * approved records that predate the publication start (e.g. an older Long Read worth keeping). It can
 * never hide or restrict any other story.
 */
export function exceptionStoryIds(env: Env = process.env): Set<string> {
  return new Set((env.V2_CURRENT_STORY_IDS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

function dubaiDateOf(iso: string): string | null {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : dubaiPublicationDate(t);
}

export function publishedStories(
  stories: Story[],
  env: Env = process.env,
): Story[] {
  const start = publicationStartDate(env);
  const exceptions = exceptionStoryIds(env);
  const seen = new Set<string>();
  return stories.filter(s => {
    if (!s.ready || seen.has(s.id)) return false;
    seen.add(s.id);
    if (exceptions.has(s.id.toLowerCase())) return true;
    if (s.homepageDate && ISO_DATE.test(s.homepageDate) && s.homepageDate >= start) return true;
    const created = dubaiDateOf(s.createdAt);
    return created !== null && created >= start;
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
}

export type EditorialType = 'Cross-Desk' | 'Briefing' | 'Long Read';

/** Latest published story of a content type, independent of homepage selection. */
export function latestOfType(published: Story[], type: EditorialType): Story | undefined {
  return published.filter(s => s.contentType === type)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))[0];
}

/** Static article routes: every published story, plus approved Watchlist stories, plus the explicit CI fixture.
 *
 *  Watchlist exception (deliberate, reviewed): /watchlist and the homepage Watchlist aside list approved Watchlist
 *  stories WITHOUT the publication cutoff, because ongoing developments may predate V2. Each of those cards links to
 *  /signals/<id>, so a route must exist or the link is dead. The exception grants a route only: such a story is never
 *  added to desks, the Signals archive, the homepage edition or the editorial panels unless it is itself published. */
export function v2ArticleRoutes(stories: Story[], env: Env = process.env): Story[] {
  const published = new Set(publishedStories(stories, env).map(s => s.id));
  return stories.filter(s => published.has(s.id) || (s.ready && s.watchlist) ||
    (env.CI === 'true' && env.V2_CI_STATIC_FIXTURE === '1' && s.id === 'ci-static-fixture'));
}
