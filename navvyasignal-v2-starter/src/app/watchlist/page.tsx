import type { Metadata } from 'next';
import { getStories, type Story } from '@/lib/notion';
import WatchCard from '@/components/WatchCard';

export const metadata: Metadata = { title: 'Watchlist' };

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
    <p className="eyebrow">ONGOING INTELLIGENCE</p>
    <h1>Watchlist</h1>
    <p className="watch-lede">Tracked situations, not ordinary breaking-news labels.</p>
    <section aria-labelledby="active-watchlist"><Heading id="active-watchlist" label="Active" count={active.length} />
      <WatchEntries stories={active} />
      {!active.length && <p className="empty">No approved active Watchlist entries.</p>}
    </section>
    {resolved.length > 0 && <section aria-labelledby="resolved-watchlist"><Heading id="resolved-watchlist" label="Resolved" count={resolved.length} /><WatchEntries stories={resolved} /></section>}
    {abandoned.length > 0 && <section aria-labelledby="abandoned-watchlist"><Heading id="abandoned-watchlist" label="Abandoned" count={abandoned.length} /><WatchEntries stories={abandoned} /></section>}
    {unspecified.length > 0 && <section aria-labelledby="unspecified-watchlist"><Heading id="unspecified-watchlist" label="Status pending editorial review" count={unspecified.length} /><WatchEntries stories={unspecified} /></section>}
  </main>;
}
