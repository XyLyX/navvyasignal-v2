import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
import ArchiveExplorer from '@/components/ArchiveExplorer';

export const metadata: Metadata = { title: 'Signals' };

export default async function Signals() {
  const stories = await getStories();
  const archive = stories.map(({ id, title, brief, category, createdAt }) => ({ id, title, brief, category, createdAt }));
  return <main className="container inner">
    <p className="eyebrow">THE HISTORICAL ARCHIVE · V2 PREVIEW</p>
    <h1>Signal Feed</h1>
    <p>Explore approved historical records by keyword, desk or Notion record creation month. These entries are not current intelligence; original publication dates and legacy URLs still require reconciliation.</p>
    <ArchiveExplorer stories={archive} />
  </main>;
}
