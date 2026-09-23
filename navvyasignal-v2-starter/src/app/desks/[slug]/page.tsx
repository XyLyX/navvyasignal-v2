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
  // Filter only after retrieving the complete approved inventory, not the first 100 records.
  const stories = (await getStories()).filter(s => matchesDeskCategory(slug, s.category));
  return <main className="container inner">
    <p className="eyebrow">INTELLIGENCE DESK</p>
    <h1>{desk.name}</h1>
    {stories.map(s => <article className="story" key={s.id}><div>
      <h3>{s.title}</h3><p>{s.brief}</p>
    </div></article>)}
    {!stories.length && <p className="empty">No matching approved stories in this preview yet.</p>}
  </main>;
}
