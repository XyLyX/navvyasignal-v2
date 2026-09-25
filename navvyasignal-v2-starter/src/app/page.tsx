import Link from 'next/link';
import { desks } from '@/lib/desks';
import { getStories } from '@/lib/notion';
import { approvedV2Ids, currentV2Stories } from '@/lib/v2Editorial';
import { dubaiPublicationDate, selectHomepageStories } from '@/lib/homepageSelection';
import GlobalPulse from '@/components/GlobalPulse';
import WatchCard from '@/components/WatchCard';
import { getNetworkCards } from '@/lib/networkMetadata';
import { getFeedSections } from '@/lib/feeds';
import { NavyaaLens } from '@/components/FeedSections';
import NetworkPanels from '@/components/NetworkPanels';

export default async function Home() {
  const [stories, networkCards, feeds] = await Promise.all([getStories(), getNetworkCards(), getFeedSections()]);
  const publicationDate = dubaiPublicationDate();
  const selected = selectHomepageStories(currentV2Stories(stories, approvedV2Ids()), publicationDate);
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
      <p className="section-deck">New, editor-approved intelligence selected for the current Dubai publication date. Historical reporting remains in the separate V1 archive.</p>
      {selected.length ? selected.map((s, i) => <article className="story" key={s.id}>
        <span className="num">{String(i + 1).padStart(2, '0')}</span><div>
          <span className="kicker">{s.category}</span><h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
        </div></article>) : <div className="editorial-empty"><span className="kicker">AWAITING TODAY’S APPROVED REPORTS</span><h3>Today's edition is being prepared.</h3><p>No editor-approved reports are dated for today. Earlier V2 reporting remains in Signals; V1 reporting is archived separately.</p><Link href="/old-archives-v1">Browse Old Archives — Version 1 →</Link></div>}
    </section><aside><h2>Watchlist</h2><p className="aside-intro">Developments under continued editorial observation.</p>
      {watch.length ? <div className="watch-list">{watch.map(s => <WatchCard key={s.id} story={s} variant="aside" />)}</div> : <p className="empty">No approved active Watchlist entries are available.</p>}
      <Link className="watch-all" href="/watchlist">View Watchlist →</Link>
    </aside></div>
    <section className="desk-section" id="desks"><div className="container"><div className="section-title"><h2>Seven intelligence desks</h2></div>
      <div className="desk-grid">{desks.map((d, i) => <Link key={d.slug} href={`/desks/${d.slug}`} className="desk">
        <span>0{i + 1}</span><h3>{d.name}</h3><b>Explore desk ↗</b>
      </Link>)}</div></div></section>
    <section className="container editorial-bottom" aria-label="Editorial formats">
      <div className="editorial-grid">
        <section className="editorial-panel"><span className="kicker">CROSS-DESK INTELLIGENCE</span>
          <h2>Where the signals connect</h2><p>Analysis across regions, markets, technology and supply chains. Original cross-desk synthesis will appear here after editorial approval.</p>
          <span className="editorial-pending">Editorial format in preparation</span>
        </section>
        <section className="editorial-panel"><span className="kicker">WEEKLY BRIEFING</span>
          <h2>The week in context</h2><p>Friday synthesis of the developments that mattered and the connections worth watching. No automated weekly email is connected to this preview.</p>
          <span className="editorial-pending">Awaiting first approved edition</span>
        </section>
        <section className="editorial-panel"><span className="kicker">LONG READS</span>
          <h2>Beyond the daily signal</h2><p>Original, deeply reported analysis with documented sources and a clear editorial publication date.</p>
          <span className="editorial-pending">Long-form desk in preparation</span>
        </section>
      </div>
      <NavyaaLens data={feeds} />
      <NetworkPanels data={feeds} heading="From the Navvya Network" />
      <section className="network-home" aria-label="The Navvya Network"><div className="section-title"><h2>The Navvya Network</h2><Link href="/network">Explore all seven →</Link></div><p>Separate publications and affiliated ventures. Commercial updates are not independent intelligence reporting.</p><div className="network-home-grid">{networkCards.filter(v => v.slug !== 'navyaa').map(v => <a key={v.slug} href={v.url} target="_blank" rel="noopener noreferrer" className="network-home-card"><span className="network-home-visual">{v.image ? <img src={v.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={`network-visual-fallback network-visual-${v.slug}`} aria-hidden="true"><span>{v.name}</span></span>}</span><span className="network-home-info"><span className="kicker">{v.category}</span><strong>{v.name} ↗</strong><small>{v.displayDescription}</small></span></a>)}</div></section>
      <section className="sponsor-reserve" aria-label="Future sponsorship placement">
        <span className="kicker">SPONSORSHIP</span><p>Reserved for clearly disclosed sponsorship and contextual advertising. No paid placement is active in this preview.</p>
      </section>
    </section>
  </main>;
}
