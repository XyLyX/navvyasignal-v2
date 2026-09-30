'use client';

import { useEffect, useState } from 'react';
import type { FeedSections } from '@/lib/feeds';
import { FEED_REFRESH_MS, mergeLiveFeeds } from '@/lib/rss/live';
import { NavyaaLens } from './FeedSections';
import NetworkPanels from './NetworkPanels';

export default function LiveFeedSections({ initial, includeNavyaa = false, heading }: {
  initial: FeedSections; includeNavyaa?: boolean; heading?: string;
}) {
  const [data, setData] = useState(initial);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    let disposed = false;
    let active: AbortController | undefined;
    let lastAttempt = 0;
    async function refresh() {
      if (disposed || active || document.hidden) return;
      lastAttempt = Date.now();
      const controller = new AbortController();
      active = controller;
      const timeout = window.setTimeout(() => controller.abort(), 20_000);
      try {
        const response = await fetch('/api/publication-feeds', { signal: controller.signal });
        if (!response.ok) throw new Error('Feed refresh unavailable');
        const next: FeedSections = await response.json();
        if (!next.navyaa || !Array.isArray(next.network) || !Number.isFinite(Date.parse(next.retrievedAt))) throw new Error('Invalid feed response');
        if (!disposed) {
          setData(previous => mergeLiveFeeds(previous, next));
          setUnavailable([next.navyaa, ...next.network].some(r => r.status === 'unavailable' || r.status === 'all-rejected'));
        }
      } catch {
        if (!disposed) setUnavailable(true);
      } finally {
        window.clearTimeout(timeout);
        if (active === controller) active = undefined;
      }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), FEED_REFRESH_MS);
    const onVisible = () => { if (!document.hidden && Date.now() - lastAttempt >= FEED_REFRESH_MS) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { disposed = true; active?.abort(); window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return <>
    {includeNavyaa && <NavyaaLens data={data} />}
    <NetworkPanels data={data} heading={heading} />
    {unavailable && <p className="np-meta" role="status">Some feeds could not be refreshed. Previously retrieved articles remain visible where available.</p>}
  </>;
}
