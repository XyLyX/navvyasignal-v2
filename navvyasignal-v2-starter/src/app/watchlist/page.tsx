import type { Metadata } from 'next';
import { getStories, type Story } from '@/lib/notion';
import WatchCard, { type WatchEntry } from '@/components/WatchCard';
import WatchTabs from '@/components/WatchTabs';

export const metadata: Metadata = { title: 'Watchlist' };

const slim = (s: Story): WatchEntry => ({ id: s.id, title: s.title, brief: s.brief, watchStatus: s.watchStatus, nextReview: s.nextReview });

function WatchEntries({ stories }: { stories: Story[] }) {
  return <div className="watch-grid">{stories.map(s => <WatchCard key={s.id} story={s} variant="page" />)}</div>;
}

function Heading({ id, label, count }: { id: string; label: string; count: number }) {
  return <h2 id={id} className="watch-heading">{label} <span className="watch-count" aria-label={`${count} entries`}>{count}</span></h2>;
}

export default async function Watchlist() {
  const stories = (await getStories()).filter(s => s.watchlist);
  const active = stories.filter(s => s.watchStatus === 'Active');
  const resolved = stories.filter(s => s.watchStatus === 'Resolved');
  const abandoned = stories.filter(s => s.watchStatus === 'Abandoned');
  const unspecified = stories.filter(s => !['Active', 'Resolved', 'Abandoned'].includes(s.watchStatus));
  return <main className="container inner watch-page">
    <header className="intelligence-page-hero">\n    <p className="eyebrow">ONGOING INTELLIGENCE</p>
    <h1>Watchlist</h1>
    <p className="watch-lede">Tracked situations, not ordinary breaking-news labels.</p>\n    </header>
    <WatchTabs tabs={[
      { id: 'active', label: 'Active', entries: active.map(slim) },
      { id: 'resolved', label: 'Resolved', entries: resolved.map(slim) },
    ]} />
    {abandoned.length > 0 && <section aria-labelledby="abandoned-watchlist"><Heading id="abandoned-watchlist" label="Abandoned" count={abandoned.length} /><WatchEntries stories={abandoned} /></section>}
    {unspecified.length > 0 && <section aria-labelledby="unspecified-watchlist"><Heading id="unspecified-watchlist" label="Status pending editorial review" count={unspecified.length} /><WatchEntries stories={unspecified} /></section>}
  </main>;
}
