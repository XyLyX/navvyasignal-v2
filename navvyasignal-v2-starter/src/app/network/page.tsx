import NetworkArtwork from '@/components/NetworkArtwork';
import Link from 'next/link';
import { getNetworkCards } from '@/lib/networkMetadata';
import { getFeedSections } from '@/lib/feeds';
import LiveFeedSections from '@/components/LiveFeedSections';
export const metadata = { title:'The Navvya Network', description:'Discover the separately operated publications and affiliated businesses in the Navvya Network.' };
export default async function NetworkPage(){
 const [cards, feeds] = await Promise.all([getNetworkCards(), getFeedSections()]);
 return <main className="container inner network-page">
  <p className="eyebrow">AFFILIATED PUBLICATIONS & BUSINESSES</p>
  <h1>The Navvya Network</h1>
  <p className="intro">Explore our separate editorial publication and affiliated businesses. Their articles, products and announcements are not NavvyaSignal intelligence reporting or editorial endorsements.</p>
  <div className="network-grid">{cards.map(v=><article className="network-card" key={v.slug}>
    <a className="network-card-visual" href={v.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${v.name}`}>
      <NetworkArtwork name={v.name} slug={v.slug} image={v.image} siteUrl={v.url} />
    </a>
    <div className="network-card-body"><span className="kicker">{v.category}</span><h2>{v.name}</h2>
    <p>{v.displayDescription}</p><a href={v.url} target="_blank" rel="noopener noreferrer">Visit {v.name} ↗</a></div>
  </article>)}</div>
  <LiveFeedSections initial={feeds} />
  <section className="network-note"><h2>How network updates work</h2>
   <p>The homepage and Network page check the publications’ public RSS feeds independently of site builds, using a shared cache refreshed on demand about every 15 minutes and links to the original articles: Navyaa essays appear under A Different Lens, and articles from affiliated businesses appear under From the Navvya Network. Everything is attributed to its source and kept separate from Today's Intelligence. Nothing is reproduced beyond a short excerpt, and paid advertising is not active in this preview.</p>
  </section><p><Link href="/">← Back to NavvyaSignal</Link></p>
 </main>;
}
