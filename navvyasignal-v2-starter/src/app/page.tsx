import Link from 'next/link';
import { desks } from '@/lib/desks';
import { getStories } from '@/lib/notion';
import { dubaiPublicationDate, selectHomepageStories } from '@/lib/homepageSelection';
import GlobalPulse from '@/components/GlobalPulse';

export default async function Home() {
  const stories = await getStories();
  const publicationDate = dubaiPublicationDate();
  const selected = selectHomepageStories(stories, publicationDate);
  const watch = stories.filter(s => s.watchlist && s.watchStatus === 'Active').slice(0, 4);
  return <main>
    <GlobalPulse />
    <section className="lead"><div className="container"><p className="eyebrow">GLOBAL INTELLIGENCE · PREVIEW</p>
      <h1>Understand what matters.<br/><em>See what connects.</em></h1>
      <p className="intro">Independent global intelligence, grounded in documented developments and the connections between them.</p>
      <p className="lead-note">Seven desks · Historical archive · Developing watchlists</p>
    </div></section>
    <div className="container content"><section>
      <div className="section-title"><h2>Today’s Intelligence</h2><Link href="/signals">All signals →</Link></div>
      <p className="section-deck">New, editor-approved intelligence selected for the current Dubai publication date. Historical reporting remains in the archive.</p>
      {selected.length ? selected.map((s, i) => <article className="story" key={s.id}>
        <span className="num">{String(i + 1).padStart(2, '0')}</span><div>
          <span className="kicker">{s.category}</span><h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
        </div></article>) : <div className="editorial-empty"><span className="kicker">AWAITING EDITORIAL SELECTION</span><h3>Today's edition is being prepared.</h3><p>No new signals have been selected for this publication date. Historical intelligence remains available separately.</p><Link href="/signals">Explore the historical archive →</Link></div>}
    </section><aside><h2>Watchlist</h2><p className="aside-intro">Developments under continued editorial observation.</p>
      {watch.length ? watch.map(s => <article className="watch" key={s.id}>
        <span className="status">{s.watchStatus}{s.nextReview ? ` · Next review ${s.nextReview.slice(0,10)}` : ''}</span><h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3><p>{s.brief}</p>
      </article>) : <p className="empty">No approved active Watchlist entries are available.</p>}
      <Link href="/watchlist">View Watchlist →</Link>
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
      <section className="navyaa-lens" aria-label="A Different Lens from Navyaa">
        <div><span className="kicker">A DIFFERENT LENS · FROM NAVYAA</span><h2>A separate editorial perspective</h2>
          <p>A manually selected essay from Navyaa will be featured here once approved. Navyaa remains a separate publication; no automatic article import.</p></div>
        <a href="https://navyaa.blog/" target="_blank" rel="noopener noreferrer">Visit Navyaa.blog ↗</a>
      </section>
      <section className="sponsor-reserve" aria-label="Future sponsorship placement">
        <span className="kicker">SPONSORSHIP</span><p>Reserved for clearly disclosed sponsorship and contextual advertising. No paid placement is active in this preview.</p>
      </section>
    </section>
  </main>;
}
