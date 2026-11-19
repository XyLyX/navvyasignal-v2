import Link from 'next/link';
import SignalArticleBody from '@/components/SignalArticleBody';
import { articleBody } from '@/lib/signalArticle';
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
  const sources = story.body.trim().replace(/^Sources:\s*/i, '');
  // Short Signals use the reviewed brief. Only Long Reads expose Notion body blocks.
  const fullEditorial = story.contentType === 'Long Read' ? await getLongReadBlocks(story.id) : [];
  const article = articleBody(story.brief, fullEditorial);
  const recordedDate = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(story.createdAt));
  const sourceParts = sources.split(/(https?:\/\/[^\s<>]+)/g);
  return <main className="container inner signal-article">
    <p className="eyebrow">CURRENT INTELLIGENCE · V2</p>
    <p className="kicker">{story.category}{story.contentType ? ` · ${story.contentType}` : ''}</p>
    <h1>{story.title}</h1>
    <p className="signal-date">Record added <time dateTime={story.createdAt}>{recordedDate}</time></p>
    {article.blocks.length > 0 ? <section className="signal-body" aria-label={article.label}>
      <SignalArticleBody blocks={article.blocks} />
    </section> : <p className="empty">No report text is available for this record.</p>}
    {sources && <section aria-label="Sources"><h2>Sources</h2><p className="signal-sources">{sourceParts.map((part, index) => {
        if (!/^https?:\/\//.test(part)) return <span key={index}>{part}</span>;
        const href = part.replace(/[.,;:)\]]+$/, '');
        try {
          const url = new URL(href);
          return <span key={index}><a href={href} target="_blank" rel="noopener noreferrer">{url.hostname.replace(/^www\./, '')}</a>{part.slice(href.length)}</span>;
        } catch { return <span key={index}>{part}</span>; }
      })}</p></section>}
    <p className="signal-date-note">The record date indicates when this Signal was added, rather than the date of the reported event.</p>
    <ShareLinks title={story.title} url={`https://navvyasignal.com/signals/${story.id}`} />
    <section className="article-discovery" aria-label="Explore related intelligence">
      <h2>Continue exploring</h2>
      {desk && <p><Link href={`/desks/${desk.slug}`}>Explore the {desk.name} desk →</Link></p>}
      {related.length > 0 && <><h3>Related signals</h3><ul>{related.map(item => <li key={item.id}><Link href={`/signals/${item.id}`}>{item.title}</Link></li>)}</ul></>}
      <p><Link href="/signals">← Back to Signal Feed</Link></p>
    </section>
  </main>;
}

