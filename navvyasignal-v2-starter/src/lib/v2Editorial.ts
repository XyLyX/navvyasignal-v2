import type { Story } from './notion';

/**
 * Fresh V2 editorial gate. Only explicitly selected records can become regular
 * V2 Signals articles. The Watchlist is a separate ongoing editorial product.
 * No arbitrary age cutoff and no reuse of Framer's Synced flag.
 */
export function currentV2Stories(stories: Story[], approvedIds: readonly string[]): Story[] {
  const approved = new Set(approvedIds.map(id => id.trim().toLowerCase()).filter(Boolean));
  return stories.filter(s => s.ready && approved.has(s.id.toLowerCase()));
}

/** Configured editorial IDs only. An empty selection deliberately publishes no regular articles. */
export function approvedV2Ids(): string[] {
  return (process.env.V2_CURRENT_STORY_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);
}

/** Keep approved Watchlist routes available without putting them in the regular news feed. */
export function v2ArticleRoutes(stories: Story[], approvedIds: readonly string[]): Story[] {
  const selected = new Set(currentV2Stories(stories, approvedIds).map(s => s.id));
  return stories.filter(s => selected.has(s.id) || (s.ready && s.watchlist));
}
