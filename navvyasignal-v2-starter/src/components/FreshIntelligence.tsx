'use client';
import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Story } from '@/lib/notion';
import { isHomepageFresh, selectFreshIntelligence } from '@/lib/homepageFreshness';
import ExpandableEditorial from './ExpandableEditorial';

function useClock(initialNow: number) {
  const [now, setNow] = useState(initialNow);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = setInterval(update, 30_000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  return now;
}

export function FreshHomepageItem({ story, initialNow, children }: { story: Story; initialNow: number; children: ReactNode }) {
  return isHomepageFresh(story, useClock(initialNow)) ? <>{children}</> : null;
}

export default function FreshIntelligence({ stories, initialNow }: { stories: Story[]; initialNow: number }) {
  const selected = selectFreshIntelligence(stories, useClock(initialNow));
  const timestamp = (iso: string) => new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
  return <>
    <p className="section-deck">The newest approved signals from the past 24 hours. Up to seven reports, newest first; older reporting remains in Signals.</p>
    {selected.length ? selected.map((story, i) => <article className="story" key={story.id}>
      <span className="num">{String(i + 1).padStart(2, '0')}</span><div>
        <p className="edition-line"><time dateTime={story.createdAt}>{timestamp(story.createdAt)} Dubai</time></p>
        <ExpandableEditorial story={story} label={story.category} />
      </div>
    </article>) : <div className="editorial-empty"><span className="kicker">NO FRESH APPROVED SIGNALS</span>
      <h3>Awaiting fresh intelligence.</h3><p>No approved signals from the past 24 hours are available. Older reports are available in Signals.</p>
      <Link href="/signals">Browse Signals →</Link></div>}
  </>;
}
