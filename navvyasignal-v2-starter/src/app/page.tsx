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
  const selected = selectHomepageStories(currentV2Stories(stories, approvedV2Ids()), publicationDate, 8);
  const edition = currentV2Stories(stories, approvedV2Ids());
  const latestCrossDesk = edition.filter(s => s.contentType === 'Cross-Desk').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  const latestBriefing = edition.filter(s => s.contentType === 'Briefing').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
  const latestLongRead = edition.filter(s => s.contentType === 'Long Read').sort((a,b)=>b.createdAt.localeCompare(a.createdAt))[0];
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
      <div className="desk-grid">{desks.map((d, i) => <Link key={d.slug} href={`/desks/${d.slug}`} className={`desk desk--${d.slug}`}>
        <span>0{i + 1}</span><h3>{d.name}</h3><b>Explore desk ↗</b>
      </Link>)}</div></div></section>
    <section className="container editorial-bottom" aria-label="Editorial formats">
      <div className="editorial-grid">
        <section className="editorial-panel"><span className="kicker">CROSS-DESK INTELLIGENCE</span>
          <h2>Where the signals connect</h2>{latestCrossDesk ? <><h3><Link href={`/signals/${latestCrossDesk.id}`}>{latestCrossDesk.title}</Link></h3><p>{latestCrossDesk.brief}</p><Link href={`/signals/${latestCrossDesk.id}`}>Read cross-desk brief →</Link></> : <span className="editorial-pending">Awaiting an approved cross-desk report</span>}
        </section>
        <section className="editorial-panel"><span className="kicker">WEEKLY BRIEFING</span>
          <h2>The week in context</h2>{latestBriefing ? <><h3><Link href={`/signals/${latestBriefing.id}`}>{latestBriefing.title}</Link></h3><p>{latestBriefing.brief || latestBriefing.body.slice(0,350)}</p><Link href={`/signals/${latestBriefing.id}`}>Read latest briefing →</Link></> : <span className="editorial-pending">Awaiting first approved edition</span>}
        </section>
        <section className="editorial-panel"><span className="kicker">LONG READS</span>
          <h2>Beyond the daily signal</h2>{latestLongRead ? <><h3><Link href={`/signals/${latestLongRead.id}`}>{latestLongRead.title}</Link></h3><p>{latestLongRead.brief}</p><span className="editorial-pending">{latestLongRead.body.trim() ? 'Read the long-form editorial' : 'Latest long-read brief · full article pending editorial integration'}</span><p><Link href={`/signals/${latestLongRead.id}`}>Read available report →</Link></p></> : <span className="editorial-pending">Awaiting an approved long read</span>}
        </section>
      </div>
      <NavyaaLens data={feeds} />
      <NetworkPanels data={feeds} heading="From the Navvya Network" />
      <section className="network-home" aria-label="The Navvya Network"><div className="section-title"><h2>The Navvya Network</h2><Link href="/network">Explore the network →</Link></div><p>Separate publications and affiliated ventures. Commercial updates are not independent intelligence reporting.</p>
      <div className="network-home-grid">{['om4biz','fils-only','rate-manifest','zen-homes','design-code','d6-kitchens'].map(slug => networkCards.find(v => v.slug === slug)).filter((v): v is NonNullable<typeof v> => v != null).map(v =>
        <a key={v.slug} href={v.url} target="_blank" rel="noopener noreferrer" className="network-home-card">
          <span className="network-home-visual">{v.image ? <img src={v.image} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <span className={`network-visual-fallback network-visual-${v.slug}`} aria-hidden="true"><span>{v.name}</span></span>}</span>
          <span className="network-home-info"><span className="kicker">{v.category}</span><strong>{v.name} ↗</strong><small>{v.displayDescription}</small></span>
        </a>)}
        {networkCards.filter(v => v.slug === 'the-wasam').map(v =>
          <a key={v.slug} href={v.url} target="_blank" rel="noopener noreferrer" className="network-home-card">
            <span className="network-home-visual">{v.image ? <img src={v.image} alt="The Wasam website cover or logo" loading="lazy" referrerPolicy="no-referrer" /> : <span className="network-wasam-visual"><span>THE WASAM</span></span>}</span>
            <span className="network-home-info"><span className="kicker">{v.category}</span><strong>{v.name} ↗</strong><small>{v.displayDescription}</small></span>
          </a>)}
        {[1,2].map(n => <div key={n} className="network-home-card network-coming-soon" aria-label={`Coming soon — future network venture ${n}`}>
          <span className="network-home-visual network-soon-visual"><span>COMING SOON</span></span>
          <span className="network-home-info"><span className="kicker">FUTURE VENTURE</span><strong>Coming Soon</strong><small>Another venture will join the network.</small></span>
        </div>)}
      </div></section>
      <section className="sponsor-reserve" aria-label="Future sponsorship placement">
        <span className="kicker">SPONSORSHIP</span><p>Reserved for clearly disclosed sponsorship and contextual advertising. No paid placement is active in this preview.</p>
      </section>
    </section>
  </main>;
}
