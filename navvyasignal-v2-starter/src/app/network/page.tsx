import Link from 'next/link';
import { getNetworkCards } from '@/lib/networkMetadata';
import { getFeedSections } from '@/lib/feeds';
import NetworkPanels from '@/components/NetworkPanels';
export const metadata = { title:'The Navvya Network', description:'Discover the separately operated publications and affiliated businesses in the Navvya Network.' };
export default async function NetworkPage(){
 const [cards, feeds] = await Promise.all([getNetworkCards(), getFeedSections()]);
 return <main className="container inner network-page">
  <p className="eyebrow">AFFILIATED PUBLICATIONS & BUSINESSES</p>
  <h1>The Navvya Network</h1>
  <p className="intro">Explore our separate editorial publication and affiliated businesses. Their articles, products and announcements are not NavvyaSignal intelligence reporting or editorial endorsements.</p>
  <div className="network-grid">{cards.map(v=><article className="network-card" key={v.slug}>
    <a className="network-card-visual" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${v.name}`}>
      {v.image ? <img src={v.image} alt={`${v.name} website preview`} loading="lazy" referrerPolicy="no-referrer" /> : <span className={`network-visual-fallback network-visual-${v.slug}`} aria-hidden="true"><span>{v.name}</span><small>{v.category}</small></span>}
    </a>
    <div className="network-card-body"><span className="kicker">{v.category}</span><h2>{v.name}</h2>
    <p>{v.displayDescription}</p><a href={v.url} target="_blank" rel="noopener noreferrer">Visit {v.name} ↗</a></div>
  </article>)}</div>
  <NetworkPanels data={feeds} />
  <section className="network-note"><h2>How network updates work</h2>
   <p>At build time the homepage reads each publication's public RSS feed and links to the original articles: Navyaa essays appear under A Different Lens, and articles from affiliated businesses appear under From the Navvya Network. Everything is attributed to its source and kept separate from Today's Intelligence. Nothing is reproduced beyond a short excerpt, and paid advertising is not active in this preview.</p>
  </section><p><Link href="/">← Back to NavvyaSignal</Link></p>
 </main>;
}
