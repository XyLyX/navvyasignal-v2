import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStories, getLongReadBlocks } from '@/lib/notion';
import { desks, matchesDeskCategory } from '@/lib/desks';
import { approvedV2Ids, v2ArticleRoutes } from '@/lib/v2Editorial';

export const dynamicParams = false;

export async function generateStaticParams() {
  const stories = await getStories();
  return v2ArticleRoutes(stories, approvedV2Ids()).map(story => ({ id: story.id }));
}

export default async function LegacySignal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stories = await getStories();
  const visible = v2ArticleRoutes(stories, approvedV2Ids());
  const story = visible.find(item => item.id === id);
  if (!story) notFound();
  const desk = desks.find(d => matchesDeskCategory(d.slug, story.category));
  const related = visible.filter(item => item.id !== story.id && item.category === story.category).slice(0, 3);
  // Notion Text 1 contains legacy <br> separators. Never inject it as HTML.
  const paragraphs = story.body.split(/(?:<br\s*\/?\s*>\s*){1,}|\n{2,}/gi)
    .map(part => part.trim()).filter(Boolean);
  const fullEditorial = story.contentType === 'Long Read' && paragraphs.length === 0
    ? await getLongReadBlocks(story.id) : [];
  const articleParagraphs = paragraphs.length ? paragraphs : fullEditorial;
  const recordedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(story.createdAt));
  return <main className="container inner">
    <p className="eyebrow">CURRENT INTELLIGENCE · V2</p>
    <p className="kicker">{story.category}{story.contentType ? ` · ${story.contentType}` : ''}</p>
    <h1>{story.title}</h1>
    <p><small>Notion record created: {recordedDate}. This is not a verified original publication date.</small></p>
    {story.brief && <section aria-label="Signal brief"><h2>Signal brief</h2><p>{story.brief}</p></section>}
    {articleParagraphs.length > 0 ? <section aria-label="Editorial text">
      <h2>{story.contentType === 'Long Read' ? 'Long read' : 'Editorial text'}</h2>
      {articleParagraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    </section> : <p className="empty">No additional full article text is available for this record. The Signal Brief above is not presented as a full article.</p>}
    <p><small>Editorial record sourced from Notion. The record creation date is not necessarily the original publication date.</small></p>
    <section className="article-discovery" aria-label="Explore related intelligence">
      <h2>Continue exploring</h2>
      {desk && <p><Link href={`/desks/${desk.slug}`}>Explore the {desk.name} desk →</Link></p>}
      {related.length > 0 && <><h3>Related signals</h3><ul>{related.map(item => <li key={item.id}><Link href={`/signals/${item.id}`}>{item.title}</Link></li>)}</ul></>}
      <p><Link href="/signals">← Back to Signal Feed</Link></p>
    </section>
  </main>;
}
