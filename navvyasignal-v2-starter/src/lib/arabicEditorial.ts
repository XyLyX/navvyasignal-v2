/**
 * Independently authored and editor-approved Arabic articles.
 * Entries are checked into this collection only after Arabic editorial review.
 * Never translate English Notion records automatically at request/build time.
 */
export type ApprovedArabicArticle = {
 id: string;
 title: string;
 deck: string;
 paragraphs: readonly string[];
 deskSlug: string;
 publishedAt: string;
 reviewedBy: string;
 sourceStoryId: string;
 sourceLinks: readonly string[];
};
/** Intentionally empty until the first Arabic edition passes editorial review. */
export const approvedArabicArticles: readonly ApprovedArabicArticle[] = [];

export function findApprovedArabicArticle(id: string): ApprovedArabicArticle | undefined {
 return approvedArabicArticles.find(a => a.id === id && a.reviewedBy.trim().length > 0 &&
   a.title.trim().length > 0 && a.paragraphs.length > 0 && a.sourceLinks.length > 0);
}
