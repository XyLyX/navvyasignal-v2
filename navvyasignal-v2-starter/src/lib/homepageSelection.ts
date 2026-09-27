import type { Story } from './notion';

/** Calendar date in the publication's Dubai timezone, evaluated at static build time. */
export function dubaiPublicationDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

/** Manual checkbox + exact calendar date + approval; lower numeric priority comes first. */
export function selectHomepageStories(stories: Story[], publicationDate: string, limit = 7): Story[] {
  return stories.filter(s => s.ready && s.today && s.homepageDate === publicationDate)
    .sort((a, b) => {
      const priorityA = a.homepagePriority != null && Number.isFinite(a.homepagePriority) && a.homepagePriority >= 1
        ? a.homepagePriority : Number.POSITIVE_INFINITY;
      const priorityB = b.homepagePriority != null && Number.isFinite(b.homepagePriority) && b.homepagePriority >= 1
        ? b.homepagePriority : Number.POSITIVE_INFINITY;
      return (priorityA === priorityB ? 0 : priorityA - priorityB)
        || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
    }).slice(0, limit);
}

export type HomepageEdition = {
  /** Homepage Date (YYYY-MM-DD) of the edition being shown, or null when no edition exists yet. */
  date: string | null;
  stories: Story[];
  /** True when the edition date is the current Dubai publication date. */
  isCurrent: boolean;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rolling edition: the most recent Homepage Date that has at least one approved story with
 * Today's Intelligence ticked (dates after `publicationDate` are ignored), and ONLY that date's
 * stories, up to `limit`, ordered by Homepage Priority. Stories from different dates are never
 * combined, and there is no hard expiry: if the newest edition is older than today it keeps being
 * shown, labelled with its real date, until a newer edition exists. A newer edition that is only
 * partially populated is shown as it stands (it is not padded from an earlier date).
 */
export function selectHomepageEdition(stories: Story[], publicationDate: string, limit = 7): HomepageEdition {
  let date: string | null = null;
  for (const s of stories) {
    const d = s.homepageDate;
    if (s.ready && s.today && d && ISO_DATE.test(d) && d <= publicationDate && (date === null || d > date)) date = d;
  }
  if (date === null) return { date: null, stories: [], isCurrent: false };
  return { date, stories: selectHomepageStories(stories, date, limit), isCurrent: date === publicationDate };
}
