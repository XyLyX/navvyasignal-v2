import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desks, matchesDeskCategory } from '@/lib/desks';
import { getStories } from '@/lib/notion';
import { approvedV2Ids, currentV2Stories } from '@/lib/v2Editorial';

export async function generateStaticParams() {
  return desks.map(d => ({ slug: d.slug }));
}

export default async function Desk({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const desk = desks.find(d => d.slug === slug);
  if (!desk) notFound();
  const stories = currentV2Stories(await getStories(), approvedV2Ids()).filter(s => matchesDeskCategory(slug, s.category));
  return <main className="container inner desk-detail-page">\n    <div className={`desk-detail-hero desk-detail-hero--${slug}`} aria-hidden="true" />\n    <div className="desk-detail-content">
    <p className="eyebrow">CURRENT INTELLIGENCE · V2 PREVIEW</p>
    <h1>{desk.name}</h1>
    <p>Only articles explicitly selected for the V2 edition are displayed here.</p>
    {stories.map(s => <article className="story" key={s.id}><div>
      <h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
    </div></article>)}
    {!stories.length && <p className="empty">No matching approved stories in this preview yet.</p>}
    </div>\n  </main>;
}
