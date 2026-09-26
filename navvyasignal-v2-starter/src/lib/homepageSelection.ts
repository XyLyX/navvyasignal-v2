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
