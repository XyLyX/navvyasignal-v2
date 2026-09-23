import type { Metadata } from 'next';
import { getStories, type Story } from '@/lib/notion';

export const metadata: Metadata = { title: 'Watchlist' };

function WatchEntries({ stories }: { stories: Story[] }) {
  return <>{stories.map(s => <article className="story" key={s.id}><div>
    <span className="status">{s.watchStatus}</span>
    <h3>{s.title}</h3><p>{s.brief}</p>
    {s.nextReview && <small>Next review: {s.nextReview}</small>}
  </div></article>)}</>;
}

export default async function Watchlist() {
  const stories = (await getStories()).filter(s => s.watchlist);
  const active = stories.filter(s => s.watchStatus === 'Active');
  const resolved = stories.filter(s => s.watchStatus === 'Resolved');
  const abandoned = stories.filter(s => s.watchStatus === 'Abandoned');
  const unspecified = stories.filter(s => !['Active', 'Resolved', 'Abandoned'].includes(s.watchStatus));
  return <main className="container inner">
    <p className="eyebrow">ONGOING INTELLIGENCE</p>
    <h1>Watchlist</h1>
    <p>Tracked situations, not ordinary breaking-news labels.</p>
    <section aria-labelledby="active-watchlist"><h2 id="active-watchlist">Active</h2>
      <WatchEntries stories={active} />
      {!active.length && <p className="empty">No approved active Watchlist entries.</p>}
    </section>
    {resolved.length > 0 && <section aria-labelledby="resolved-watchlist"><h2 id="resolved-watchlist">Resolved</h2><WatchEntries stories={resolved} /></section>}
    {abandoned.length > 0 && <section aria-labelledby="abandoned-watchlist"><h2 id="abandoned-watchlist">Abandoned</h2><WatchEntries stories={abandoned} /></section>}
    {unspecified.length > 0 && <section aria-labelledby="unspecified-watchlist"><h2 id="unspecified-watchlist">Status pending editorial review</h2><WatchEntries stories={unspecified} /></section>}
  </main>;
}
