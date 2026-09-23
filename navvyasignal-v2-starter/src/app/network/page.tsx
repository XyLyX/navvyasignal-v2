import Link from 'next/link';
import { networkVentures } from '@/lib/network';
export const metadata = { title:'The Navvya Network', description:'Discover the separately operated publications and affiliated businesses in the Navvya Network.' };
export default function NetworkPage(){
 return <main className="container inner">
  <p className="eyebrow">AFFILIATED PUBLICATIONS & BUSINESSES</p>
  <h1>The Navvya Network</h1>
  <p className="intro">Explore our separate editorial publication and affiliated businesses. Their articles, products and announcements are not NavvyaSignal intelligence reporting or editorial endorsements.</p>
  <div className="network-grid">{networkVentures.map(v=><article className="network-card" key={v.slug}>
    <span className="kicker">{v.category}</span><h2>{v.name}</h2><p>{v.description}</p>
    <a href={v.url} target="_blank" rel="noopener noreferrer">Visit {v.name} ↗</a>
  </article>)}</div>
  <section className="network-note"><h2>How network updates work</h2>
   <p>Navyaa articles will be featured as separately attributed editorial links once its publishing feed is verified. Updates from affiliated businesses will appear in a clearly labelled network feed, not Today's Intelligence. Automatic imports and paid advertising are not active in this preview.</p>
  </section><p><Link href="/">← Back to NavvyaSignal</Link></p>
 </main>;
}
