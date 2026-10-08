import Link from 'next/link';
import { desks } from '@/lib/desks';
import { getStories } from '@/lib/notion';
import { publishedStories, latestOfType } from '@/lib/v2Editorial';
import { isHomepageFresh } from '@/lib/homepageFreshness';
import FreshIntelligence from '@/components/FreshIntelligence';
import GlobalPulse from '@/components/GlobalPulse';
import WatchCard from '@/components/WatchCard';
import { getFeedSections } from '@/lib/feeds';
import LiveFeedSections from '@/components/LiveFeedSections';
import ExpandableEditorial from '@/components/ExpandableEditorial';

export default async function Home() {
  const [stories, feeds] = await Promise.all([getStories(), getFeedSections()]);
  const initialNow = Date.now();
  const whatsappChannel = 'https://whatsapp.com/channel/0029VbDPeHH47Xe2oj9oSL3C';
  const channelUrl = whatsappChannel && /^https:\/\/whatsapp\.com\/channel\/[a-zA-Z0-9]+\/?$/.test(whatsappChannel) ? whatsappChannel : null;
  const published = publishedStories(stories);
  const fresh = published.filter(s => isHomepageFresh(s, initialNow));
  const reportDate = (iso: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Dubai' }).format(new Date(iso));
  const latestCrossDesk = latestOfType(published, 'Cross-Desk');
  const latestBriefing = latestOfType(fresh, 'Briefing');
  const latestLongRead = latestOfType(fresh, 'Long Read');
  const watch = stories.filter(s => s.watchlist && s.watchStatus === 'Active').slice(0, 4);
  return <main>
    <GlobalPulse />
    <section className="lead"><div className="container"><p className="eyebrow">GLOBAL INTELLIGENCE</p>
      <h1>Understand what matters.<br/><em>See what connects.</em></h1>
      <p className="intro">Independent global intelligence, grounded in documented developments and the connections between them.</p>
      <p className="lead-note">Seven desks · Current reporting · Developing watchlists</p>
    </div></section>
    <div className="container content"><section>
      <div className="section-title"><h2>Today’s Intelligence</h2><Link href="/signals">All signals →</Link></div>
      <FreshIntelligence stories={fresh} initialNow={initialNow} />
    </section><aside><h2>Watchlist</h2><p className="aside-intro">Ongoing developments under observation; review dates are shown for each case.</p>
      {watch.length ? <div className="watch-list">{watch.map(s => <WatchCard key={s.id} story={s} variant="aside" />)}</div> : <p className="empty">No approved active Watchlist entries are available.</p>}
      <Link className="watch-all" href="/watchlist">View Watchlist →</Link>
    </aside></div>
    <section className="container subscribe-brief" aria-label="Daily Brief subscription"><div><h2>Subscribe to the Daily Brief</h2><p>Get in touch to request the daily intelligence briefing. We’ll confirm subscription availability by email.</p></div><a href="mailto:hello@navvyasignal.com?subject=Daily%20Brief%20subscription%20request">Request subscription →</a></section>
    {channelUrl && <section className="container whatsapp-channel-invite" aria-label="Join our WhatsApp Channel"><div><span className="kicker">NAVVYASIGNAL ON WHATSAPP</span><h2>Join our WhatsApp Channel</h2><p>Follow NavvyaSignal for intelligence updates and links to the latest reporting. Channel membership is optional and separate from the Daily Brief email subscription.</p></div><a href={channelUrl} target="_blank" rel="noopener noreferrer">Join the WhatsApp Channel ↗</a></section>}
    <section className="desk-section" id="desks"><div className="container"><div className="section-title"><h2>Seven intelligence desks</h2></div>
      <div className="desk-grid">{desks.map((d, i) => <Link key={d.slug} href={`/desks/${d.slug}`} className={`desk desk--${d.slug}`}>
        <span>0{i + 1}</span><h3>{d.name}</h3><b>Explore desk ↗</b>
      </Link>)}</div></div></section>
    <section className="container editorial-bottom" aria-label="Editorial formats">
      <div className="editorial-grid">
        <section className="editorial-panel"><span className="kicker">CROSS-DESK INTELLIGENCE</span>
          <h2>Where the signals connect</h2>{latestCrossDesk ? <><p className="edition-line">Published <time dateTime={latestCrossDesk.createdAt}>{reportDate(latestCrossDesk.createdAt)}</time></p><ExpandableEditorial story={latestCrossDesk} /></> : <span className="editorial-pending">Awaiting an approved cross-desk report</span>}
        </section>
        <section className="editorial-panel"><span className="kicker">WEEKLY BRIEFING</span>
          <h2>The week in context</h2>{latestBriefing ? <><p className="edition-line">Published <time dateTime={latestBriefing.createdAt}>{reportDate(latestBriefing.createdAt)}</time></p><ExpandableEditorial story={{...latestBriefing, brief: latestBriefing.brief || latestBriefing.body.slice(0,1200)}} /></> : <span className="editorial-pending">No approved weekly briefing available</span>}
        </section>
        <section className="editorial-panel"><span className="kicker">LONG READS</span>
          <h2>Beyond the daily signal</h2>{latestLongRead ? <><p className="edition-line">Published <time dateTime={latestLongRead.createdAt}>{reportDate(latestLongRead.createdAt)}</time></p><ExpandableEditorial story={latestLongRead} /></> : <span className="editorial-pending">Awaiting an approved long read</span>}
        </section>
      </div>
      <LiveFeedSections initial={feeds} includeNavyaa heading="From the Navvya Network" />
      <section className="sponsor-reserve" aria-label="Future sponsorship placement">
        <span className="kicker">SPONSORSHIP</span><p>Reserved for clearly disclosed sponsorship and contextual advertising. No paid placement is active in this preview.</p>
      </section>
    </section>
  </main>;
}
