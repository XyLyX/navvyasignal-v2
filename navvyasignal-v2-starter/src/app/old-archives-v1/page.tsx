import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
import { publishedStories } from '@/lib/v2Editorial';
import ArchiveExplorer from '@/components/ArchiveExplorer';

export const metadata: Metadata = {
  title: 'Historical Signal Archive — Version 1',
  description: 'Browse NavvyaSignal historical V1 editorial records preserved in Notion.',
};

export default async function OldArchivesPage() {
  const all = await getStories();
  const currentIds = new Set(publishedStories(all).map(story => story.id));
  const historical = all.filter(story => !currentIds.has(story.id));
  const archive = historical.map(({ id, title, brief, category, createdAt }) => ({
    id, title, brief, category, createdAt,
  }));
  return <main className="container inner info-page">
    <p className="eyebrow">HISTORICAL REFERENCE · VERSION 1</p>
    <h1>Old Archives — Version 1</h1>
    <p className="info-lede">Browse preserved historical NavvyaSignal records without leaving this website. These records are not current intelligence and are not automatically reclassified as new reporting.</p>
    <p><small>Dates shown in the archive are Notion record creation dates, not independently verified original publication dates. Some older records contain only a brief; original Framer article URLs are still being reconciled.</small></p>
    <ArchiveExplorer stories={archive} />
  </main>;
}
