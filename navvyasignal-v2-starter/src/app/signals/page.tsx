import type { Metadata } from 'next';
import Link from 'next/link';
import { getStories } from '@/lib/notion';

export const metadata: Metadata = { title: 'Signals' };

export default async function Signals() {
  const stories = await getStories();
  return <main className="container inner">
    <p className="eyebrow">THE HISTORICAL ARCHIVE · V2 PREVIEW</p>
    <h1>Signal Feed</h1>
    <p>Approved historical records for testing. These entries are not presented as current intelligence; legacy URLs and original publication dates still require reconciliation.</p>
    {stories.map(s => <article className="story" key={s.id}><div>
      <span className="kicker">{s.category}</span>
      <h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
    </div></article>)}
    {!stories.length && <p className="empty">No approved stories available in this preview.</p>}
  </main>;
}
