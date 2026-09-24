import type { FeedSections as Data } from '@/lib/feeds';
import { FeedCard, FeedEmpty, formatPublished } from './FeedCards';
import { NAVYAA_COUNT, NETWORK_PER_SOURCE } from '@/lib/rss/limits';


/** A DIFFERENT LENS: newest published Navyaa articles, clearly attributed to a separate publication. */
export function NavyaaLens({ data }: { data: Data }) {
  const r = data.navyaa;
  const items = r.items.slice(0, NAVYAA_COUNT);
  return <section className="navyaa-lens feed-section" aria-label="A Different Lens from Navyaa">
    <div className="feed-section-head">
      <div><span className="kicker">A DIFFERENT LENS · FROM NAVYAA</span><h2>A separate editorial perspective</h2>
        <p>Latest essays from Navyaa, a separate publication. These are Navyaa’s own words, linked to the original articles; they are not NavvyaSignal intelligence reporting.</p></div>
      <a href={r.source.siteUrl} target="_blank" rel="noopener noreferrer">Visit Navyaa.blog ↗</a>
    </div>
    {items.length
      ? <div className="feed-grid feed-grid-3">{items.map(i => <FeedCard key={i.canonicalUrl} item={i} label="Navyaa" contentType={r.source.contentType} />)}</div>
      : <FeedEmpty result={r} />}
  </section>;
}

/** FROM THE NAVVYA NETWORK: affiliated ventures only; never mixed with Today's Intelligence, Watchlist or editorial records. */
export function NetworkFeed({ data }: { data: Data }) {
  return <section className="network-feed feed-section" aria-label="From the Navvya Network">
    <div className="feed-section-head"><div><span className="kicker">AFFILIATED VENTURES · NOT INDEPENDENT REPORTING</span><h2>From the Navvya Network</h2>
      <p>Articles and announcements published by affiliated businesses on their own sites. They are commercial or promotional in nature, are not NavvyaSignal reporting, and carry no editorial endorsement.</p></div></div>
    <div className="network-feed-groups">
      {data.network.map(r => <div className="network-feed-group" key={r.source.id}>
        <h3 className="feed-group-title"><span>{r.source.name}</span><small>{r.source.contentType}</small></h3>
        {r.items.length
          ? <div className="feed-grid">{r.items.slice(0, NETWORK_PER_SOURCE).map(i => <FeedCard key={i.canonicalUrl} item={i} label={r.source.name} contentType={r.source.contentType} />)}</div>
          : <FeedEmpty result={r} />}
      </div>)}
    </div>
    {data.fixtureMode ? <p className="feed-meta">Offline fixture data; not live publications.</p>
      : <p className="feed-meta">Feeds checked when this page was built, {formatPublished(data.retrievedAt)}. Publication dates are those shown by each source.</p>}
  </section>;
}
