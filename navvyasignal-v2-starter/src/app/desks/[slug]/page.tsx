import Link from 'next/link';
import { notFound } from 'next/navigation';
import { desks, matchesDeskCategory } from '@/lib/desks';
import { getStories } from '@/lib/notion';
import { publishedStories } from '@/lib/v2Editorial';
import { watchExcerpt } from '@/lib/watchExcerpt';

export async function generateStaticParams() {
  return desks.map(d => ({ slug: d.slug }));
}

export default async function Desk({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const desk = desks.find(d => d.slug === slug);
  if (!desk) notFound();
  const stories = publishedStories(await getStories()).filter(s => matchesDeskCategory(slug, s.category));
  return <main className="container inner desk-detail-page">
    <header className={`desk-detail-header desk-detail-hero--${slug}`}>
      <p className="eyebrow">CURRENT INTELLIGENCE · V2</p>
      <h1>{desk.name}</h1>
      <p>Approved reports from this desk, newest first.</p>
    </header>
    <div className="desk-detail-content">
      {stories.map(s => <article className="story" key={s.id}><div>
        <h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3>
        <p>{watchExcerpt(s.brief, 260).excerpt}</p>
        <Link className="desk-story-link" href={`/signals/${s.id}`}>Read signal →</Link>
      </div></article>)}
      {!stories.length && <p className="empty">No matching approved stories yet.</p>}
    </div>
  </main>;
}
