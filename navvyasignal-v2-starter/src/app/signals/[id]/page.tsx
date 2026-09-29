import Link from 'next/link';
import ShareLinks from '@/components/ShareLinks';
import { notFound } from 'next/navigation';
import { getStories, getLongReadBlocks } from '@/lib/notion';
import { desks, matchesDeskCategory } from '@/lib/desks';
import { v2ArticleRoutes } from '@/lib/v2Editorial';

export const dynamicParams = false;

export async function generateStaticParams() {
  const stories = await getStories();
  return v2ArticleRoutes(stories).map(story => ({ id: story.id }));
}

export default async function LegacySignal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stories = await getStories();
  const visible = v2ArticleRoutes(stories);
  const story = visible.find(item => item.id === id);
  if (!story) notFound();
  const desk = desks.find(d => matchesDeskCategory(d.slug, story.category));
  const related = visible.filter(item => item.id !== story.id && item.category === story.category).slice(0, 3);
  // Current pipeline: Signal Brief is editorial prose; Text 1 is sources, never article body.
  const briefParagraphs = story.brief.replace(/\\n/g, '\n').split(/(?:<br\s*\/?\s*>\s*){1,}|\n{2,}/gi)
    .map(part => part.trim()).filter(Boolean);
  const sources = story.body.trim();
  // Notion page blocks on short Signals can contain unreviewed working notes.
  // Only explicitly classified Long Reads expose the full page body.
  const fullEditorial = story.contentType === 'Long Read'
    ? await getLongReadBlocks(story.id) : [];
  const recordedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(story.createdAt));
  return <main className="container inner">
    <p className="eyebrow">CURRENT INTELLIGENCE · V2</p>
    <p className="kicker">{story.category}{story.contentType ? ` · ${story.contentType}` : ''}</p>
    <h1>{story.title}</h1>
    <p><small>Notion record created: {recordedDate}. This is not a verified original publication date.</small></p>
    {briefParagraphs.length > 0 ? <section aria-label="Signal brief">
      <h2>Signal brief</h2>
      {briefParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section> : <p className="empty">No report text is available for this record.</p>}
    {fullEditorial.length > 0 && <section aria-label="Long read"><h2>Long read</h2>
      {fullEditorial.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section>}
    {sources && <section aria-label="Sources"><h2>Sources</h2><p className="signal-sources">{sources}</p></section>}
    <p className="signal-invitation">Follow the next development at <Link href="/">navvyasignal.com</Link>.</p>
    <p><small>Editorial record sourced from Notion. The record creation date is not necessarily the original publication date.</small></p>
    <ShareLinks title={story.title} url={`https://navvyasignal.com/signals/${story.id}`} />
    <section className="article-discovery" aria-label="Explore related intelligence">
      <h2>Continue exploring</h2>
      {desk && <p><Link href={`/desks/${desk.slug}`}>Explore the {desk.name} desk →</Link></p>}
      {related.length > 0 && <><h3>Related signals</h3><ul>{related.map(item => <li key={item.id}><Link href={`/signals/${item.id}`}>{item.title}</Link></li>)}</ul></>}
      <p><Link href="/signals">← Back to Signal Feed</Link></p>
    </section>
  </main>;
}
