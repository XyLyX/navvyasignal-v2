import Link from 'next/link';
import type { Story } from '@/lib/notion';

/** The fields a card needs; keeps client payloads small (no article body). */
export type WatchEntry = Pick<Story, 'id' | 'title' | 'brief' | 'watchStatus' | 'nextReview'>;
import { briefParagraphs, watchExcerpt } from '@/lib/watchExcerpt';

export const WATCH_EXCERPT_ASIDE = 220;
export const WATCH_EXCERPT_PAGE = 155;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * One Watchlist entry. The excerpt is display-only; the title and "Read full analysis" link go to the existing
 * /signals/<id> page that every approved record has, and the /watchlist variant also offers the full brief inline.
 */
export default function WatchCard({ story, variant }: { story: WatchEntry; variant: 'aside' | 'page' }) {
  const { excerpt, truncated } = watchExcerpt(story.brief, variant === 'aside' ? WATCH_EXCERPT_ASIDE : WATCH_EXCERPT_PAGE);
  const href = `/signals/${story.id}`;
  const review = story.nextReview && ISO_DAY.test(story.nextReview) ? story.nextReview.slice(0, 10) : story.nextReview;
  return <article className={`watch watch-card watch-card-${variant}`}>
    <div className="watch-meta">
      <span className="status">{story.watchStatus || 'Status pending'}</span>
      {review ? <span className="watch-review">Next review <time dateTime={ISO_DAY.test(review) ? review : undefined}>{review}</time></span> : null}
    </div>
    <h3><Link href={href}>{story.title}</Link></h3>
    {excerpt ? <p className="watch-excerpt">{excerpt}</p> : null}
    {variant === 'page' && truncated
      ? <details className="watch-details"><summary>Show full summary</summary>
        {briefParagraphs(story.brief).map((para, i) => <p key={i}>{para}</p>)}
      </details>
      : null}
    <Link className="watch-more" href={href}>Read full analysis →</Link>
  </article>;
}
