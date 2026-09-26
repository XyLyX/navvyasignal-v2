import type { FeedSections as Data } from '@/lib/feeds';
import { FeedCard, FeedEmpty } from './FeedCards';
import { NAVYAA_COUNT } from '@/lib/rss/limits';

/**
 * A DIFFERENT LENS: newest published Navyaa articles, clearly attributed to a separate publication.
 * The Explore tile (Navyaa's own logo, linking to the publication) sits above the third essay on desktop.
 */
export function NavyaaLens({ data }: { data: Data }) {
  const r = data.navyaa;
  const items = r.items.slice(0, NAVYAA_COUNT);
  return <section className="navyaa-lens feed-section nl" aria-label="A Different Lens from Navyaa">
    <div className="nl-head">
      <span className="kicker">A DIFFERENT LENS · FROM NAVYAA</span><h2>A separate editorial perspective</h2>
      <p>Latest essays from Navyaa, a separate publication. These are Navyaa’s own words, linked to the original articles; they are not NavvyaSignal intelligence reporting.</p>
    </div>
    <a className="nl-tile" href={r.source.siteUrl} target="_blank" rel="noopener noreferrer" aria-label="Explore Navyaa (opens navyaa.blog)">
      <span className="nl-tile-logo">
        {/* Text fallback renders underneath; Navyaa's own logo covers it once loaded. */}
        <span className="nl-tile-fallback" aria-hidden="true">Navyaa</span>
        {r.source.logoUrl ? <img src={r.source.logoUrl} alt="Navyaa logo" loading="lazy" referrerPolicy="no-referrer" /> : null}
      </span>
      <span className="nl-tile-cta">Explore ↗</span>
    </a>
    <div className="nl-cards">
      {items.length
        ? <div className="feed-grid feed-grid-3">{items.map(i => <FeedCard key={i.canonicalUrl} item={i} label="Navyaa" contentType={r.source.contentType} />)}</div>
        : <FeedEmpty result={r} />}
    </div>
  </section>;
}
