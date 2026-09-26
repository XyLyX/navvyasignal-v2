import Link from 'next/link';
import type { FeedSections } from '@/lib/feeds';
import { buildNetworkPanels, type FeedPanel } from '@/lib/networkPanels';
import { formatPublished } from './FeedCards';

const EMPTY_TEXT: Record<string, string> = {
  unavailable: 'This publication’s feed could not be reached when the site was last built.',
  'all-rejected': 'No valid articles could be read from this publication’s feed when the site was last built.',
  empty: 'No published articles are listed yet.',
};

const MARK: Record<string, string> = { om4biz: 'OM', 'd6-kitchens': 'D6', 'zen-insights': 'Z', 'zen-portfolio': 'Z', 'design-code': 'DC' };

function Panel({ p }: { p: FeedPanel }) {
  return <section className="np-panel" aria-labelledby={`np-${p.id}`}>
    <header className="np-head">
      <div><span className="np-kicker">{p.contentType} · from {p.sourceName}</span><h3 id={`np-${p.id}`}>{p.title}</h3></div>
      <a className="np-site" href={p.siteUrl} target="_blank" rel="noopener noreferrer">Visit site ↗</a>
    </header>
    <div className="np-slots">
      {p.items.map(item => <article className="np-item" key={item.canonicalUrl}>
        <a className="np-thumb" href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
          <span className={`np-thumb-fallback np-cover-${p.id}`} data-mark={MARK[p.id] ?? p.sourceName.slice(0, 2)}><span>{p.sourceName}</span><small>{p.contentType}</small></span>
          {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
        </a>
        <div className="np-item-body">
          <time dateTime={item.publishedAt}>{formatPublished(item.publishedAt)}</time>
          <h4><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h4>
          {item.excerpt ? <p>{item.excerpt}</p> : null}
          <a className="np-read" href={item.url} target="_blank" rel="noopener noreferrer">Read on {p.sourceName} ↗</a>
        </div>
      </article>)}
      {p.items.length === 0 ? <p className="np-empty">{EMPTY_TEXT[p.status] ?? EMPTY_TEXT.empty}</p> : null}
    </div>
    <footer className="np-foot">
      <a href={p.siteUrl} target="_blank" rel="noopener noreferrer" aria-label={`Browse articles on ${p.title} (opens ${p.sourceName})`}>Browse Articles ↗</a>
    </footer>
  </section>;
}

/** Six equal panels: five RSS-fed publications plus Join Our Network. Editorially separate from NavvyaSignal reporting. */
export default function NetworkPanels({ data, heading = 'Latest from the network' }: { data: FeedSections; heading?: string }) {
  const panels = buildNetworkPanels(data.network);
  return <section className="np-section" aria-label="Latest from the Navvya Network">
    <div className="np-intro"><span className="kicker">AFFILIATED VENTURES · NOT INDEPENDENT REPORTING</span><h2>{heading}</h2>
      <p>Articles and announcements published by affiliated businesses on their own sites. They are commercial or promotional in nature, are not NavvyaSignal reporting, and carry no editorial endorsement.</p></div>
    <div className="np-grid">
      {panels.map(p => p.kind === 'feed' ? <Panel key={p.id} p={p} /> : <section className="np-panel np-join" key={p.id} aria-labelledby="np-join">
        <header className="np-head"><div><span className="np-kicker">Open invitation</span><h3 id="np-join">{p.title}</h3></div></header>
        <div className="np-join-body">
          <p>Run a publication or a business you would like to see in the Navvya Network? Introduce yourself and tell us what you publish.</p>
          <p className="np-join-note">Network listings are separate from NavvyaSignal’s intelligence reporting and are not editorial endorsements.</p>
          <Link className="np-join-cta" href={p.href}>Start an Enquiry →</Link>
        </div>
      </section>)}
    </div>
    {data.fixtureMode ? <p className="np-meta">Offline fixture data; not live publications.</p>
      : <p className="np-meta">Feeds checked when this page was built, {formatPublished(data.retrievedAt)}. Publication dates are those shown by each source.</p>}
  </section>;
}
