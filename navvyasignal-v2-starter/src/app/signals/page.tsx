import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
import ArchiveExplorer from '@/components/ArchiveExplorer';
import { approvedV2Ids, currentV2Stories } from '@/lib/v2Editorial';

export const metadata: Metadata = { title: 'Signals' };

export default async function Signals() {
  const stories = currentV2Stories(await getStories(), approvedV2Ids());
  const archive = stories.map(({ id, title, brief, category, createdAt }) => ({ id, title, brief, category, createdAt }));
  return <main className="container inner">
    <p className="eyebrow">CURRENT SIGNALS · V2 PREVIEW</p>
    <h1>Signal Feed</h1>
    <p>Only explicitly selected V2 reporting appears here. The original historical archive remains available separately through Old Archives — Version 1.</p>
    <ArchiveExplorer stories={archive} />
  </main>;
}
