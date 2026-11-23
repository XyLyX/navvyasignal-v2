import type { Metadata } from 'next';
import Link from 'next/link';
import { getStories } from '@/lib/notion';
import { publishedStories } from '@/lib/v2Editorial';

export const metadata: Metadata = {
  title: 'Insights',
  description: 'Approved long-form analysis and cross-desk intelligence from NavvyaSignal.',
  alternates: { canonical: '/insights' },
};

export default async function InsightsPage() {
  const stories = publishedStories(await getStories())
    .filter(story => story.contentType === 'Long Read' || story.contentType === 'Cross-Desk');
  return <main className="container inner signal-feed-page">
    <header className="intelligence-page-hero">
      <p className="eyebrow">NAVVYASIGNAL · INSIGHTS</p>
      <h1>Insights</h1>
      <p>Approved analysis and long-form reporting. Strategic Outlook is a separate editorial series.</p>
    </header>
    {stories.length ? <section aria-label="Published insights"><ul>
      {stories.map(story => <li key={story.id}>
        <h2><Link href={`/signals/${story.id}`}>{story.title}</Link></h2>
        <p>{story.brief}</p>
      </li>)}
    </ul></section> : <p className="empty">No approved insights are available yet.</p>}
    <p><Link href="/strategic-outlook">Explore Strategic Outlook →</Link></p>
  </main>;
}
