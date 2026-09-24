import type { FeedItem } from '@/lib/rss/parse';
import type { SourceResult } from '@/lib/rss/service';

const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' });
export const formatPublished = (iso: string) => dateFmt.format(new Date(iso));

export function FeedCard({ item, label, contentType }: { item: FeedItem; label: string; contentType: string }) {
  return <article className="feed-card">
    <a className="feed-card-visual" href={item.url} target="_blank" rel="noopener noreferrer" tabIndex={-1} aria-hidden="true">
      {/* Text fallback always renders underneath; an authentic article image, when present, covers it. */}
      <span className="feed-card-fallback"><span>{label}</span><small>{contentType}</small></span>
      {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : null}
    </a>
    <div className="feed-card-body">
      <span className="kicker">{label} · {contentType}</span>
      <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></h3>
      <time dateTime={item.publishedAt}>{formatPublished(item.publishedAt)}</time>
      {item.excerpt ? <p>{item.excerpt}</p> : null}
      <a className="feed-card-link" href={item.url} target="_blank" rel="noopener noreferrer">Read on {label} ↗</a>
    </div>
  </article>;
}

export function FeedEmpty({ result }: { result: SourceResult }) {
  const s = result.source;
  return <div className="feed-empty">
    <span className="kicker">{s.name} · {s.contentType}</span>
    <p>{result.status === 'unavailable' ? 'This publication’s feed could not be reached when the site was last built.' : 'No published articles are listed yet.'}</p>
    <a href={s.siteUrl} target="_blank" rel="noopener noreferrer">Visit {s.name} ↗</a>
  </div>;
}
