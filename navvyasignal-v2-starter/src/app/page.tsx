import Link from 'next/link';
import { desks } from '@/lib/desks';
import { getStories, getEditorialAssessments } from '@/lib/notion';
import { publishedStories, latestOfType } from '@/lib/v2Editorial';
import {selectHomepageEdition,dubaiPublicationDate} from '@/lib/homepageSelection';
import FreshIntelligence from '@/components/FreshIntelligence';
import GlobalPulse from '@/components/GlobalPulse';
import WatchCard from '@/components/WatchCard';
import { getFeedSections } from '@/lib/feeds';
import LiveFeedSections from '@/components/LiveFeedSections';
import EditorialPanel from '@/components/EditorialPanel';

export default async function Home() {
  const [stories, feeds, assessments] = await Promise.all([getStories(), getFeedSections(), getEditorialAssessments()]);
  const initialNow = Date.now();
  const whatsappChannel = 'https://whatsapp.com/channel/0029VbDPeHH47Xe2oj9oSL3C';
  const channelUrl = whatsappChannel && /^https:\/\/whatsapp\.com\/channel\/[a-zA-Z0-9]+\/?$/.test(whatsappChannel) ? whatsappChannel : null;
  const published = publishedStories(stories);
  const fresh = selectHomepageEdition(published,dubaiPublicationDate()).stories;
  const latestCrossDesk = latestOfType(published, 'Cross-Desk');
  const latestBriefing = latestOfType(published, 'Briefing');
  const latestLongRead = latestOfType(published, 'Long Read');
  const watch = stories.filter(s => s.watchlist && s.watchStatus === 'Active').slice(0, 4);
  return <main>
    <GlobalPulse />
    <section className="lead"><div className="container"><p className="eyebrow">GLOBAL INTELLIGENCE</p>
      <h1>Understand what matters.<br/><em>See what connects.</em></h1>
      <p className="intro">Independent global intelligence, grounded in documented developments and the connections between them.</p>
      <p className="lead-note">Four regional desks · Current reporting · Developing watchlists</p>
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
    <section className="desk-section" id="desks"><div className="container"><div className="section-title"><h2>Four regional intelligence desks</h2></div>
      <div className="desk-grid">{desks.map((d, i) => <Link key={d.slug} href={`/desks/${d.slug}`} className={`desk desk--${d.slug}`}>
        <span>0{i + 1}</span><h3>{d.name}</h3><b>Explore desk ↗</b>
      </Link>)}</div></div></section>
    <section className="container editorial-bottom" aria-label="Editorial formats">
      <div className="editorial-grid">
        <EditorialPanel kind="Cross-Desk" heading="Where the signals connect" story={latestCrossDesk} assessments={assessments} initialNow={initialNow} />
        <EditorialPanel kind="Briefing" heading="The week in context" story={latestBriefing} assessments={assessments} initialNow={initialNow} />
        <EditorialPanel kind="Long Read" heading="Beyond the daily signal" story={latestLongRead} assessments={assessments} initialNow={initialNow} />
      </div>
      <LiveFeedSections initial={feeds} includeNavyaa heading="From the Navvya Network" />
      <section className="sponsor-reserve" aria-label="Future sponsorship placement">
        <span className="kicker">SPONSORSHIP</span><p>Reserved for clearly disclosed sponsorship and contextual advertising. No paid placement is active in this preview.</p>
      </section>
    </section>
  </main>;
}
