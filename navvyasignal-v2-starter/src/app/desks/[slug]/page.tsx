import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desks, matchesDeskCategory } from '@/lib/desks';
import { getStories } from '@/lib/notion';

export async function generateStaticParams() {
  return desks.map(d => ({ slug: d.slug }));
}

export default async function Desk({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const desk = desks.find(d => d.slug === slug);
  if (!desk) notFound();
  const stories = (await getStories()).filter(s => matchesDeskCategory(slug, s.category));
  return <main className="container inner">
    <p className="eyebrow">HISTORICAL INTELLIGENCE · V2 PREVIEW</p>
    <h1>{desk.name}</h1>
    <p>Archived approved signals for layout testing; not a current news feed.</p>
    {stories.map(s => <article className="story" key={s.id}><div>
      <h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
    </div></article>)}
    {!stories.length && <p className="empty">No matching approved stories in this preview yet.</p>}
  </main>;
}
