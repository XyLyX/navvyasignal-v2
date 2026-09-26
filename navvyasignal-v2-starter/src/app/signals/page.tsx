import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
import ArchiveExplorer from '@/components/ArchiveExplorer';
import { approvedV2Ids, currentV2Stories } from '@/lib/v2Editorial';

export const metadata: Metadata = { title: 'Signals' };

export default async function Signals() {
  const stories = currentV2Stories(await getStories(), approvedV2Ids());
  const archive = stories.map(({ id, title, brief, category, createdAt }) => ({ id, title, brief, category, createdAt }));
  return <main className="container inner signal-feed-page">
    <header className="intelligence-page-hero">\n    <p className="eyebrow">CURRENT SIGNALS · SEPTEMBER 2026 EDITION</p>
    <h1>Signal Feed</h1>
    <p>The latest editor-approved reports are listed by their V2 publication date, beginning 25 September 2026. Earlier V1 reporting remains in the separate archive.</p>\n    </header>
    <ArchiveExplorer stories={archive} />
  </main>;
}
