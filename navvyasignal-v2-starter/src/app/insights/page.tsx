import type {Metadata} from 'next';
import Link from 'next/link';
import {getInsights,categorySlugs} from '@/lib/insights';
export const metadata:Metadata={title:'Insights & Analysis',description:'Original long-form geopolitical intelligence, historical explainers, future scenarios and special reports from NavvyaSignal.',alternates:{canonical:'/insights',types:{'application/rss+xml':'/insights/rss.xml'}}};
export default async function InsightsPage(){
 const articles=await getInsights();
 return <main className="container inner insights-page"><header className="intelligence-page-hero"><p className="eyebrow">NAVVYASIGNAL · EDITORIAL INTELLIGENCE</p><h1>Insights &amp; Analysis</h1><p>Beyond the daily signal: evidence-led analysis, historical context and scenarios for what comes next.</p><a href="/insights/rss.xml">Subscribe via RSS ↗</a></header>
 <nav className="insights-categories" aria-label="Article categories">{Object.entries(categorySlugs).map(([slug,name])=><a key={slug} href={`/insights/${slug}/rss.xml`} title={`Subscribe to ${name} RSS`}>{name} RSS ↗</a>)}</nav>
 {articles.length?<div className="insights-grid">{articles.map(a=><article className="insight-card" key={a.slug}><p className="eyebrow">{a.category} · {a.desk}</p><h2><Link href={`/insights/${a.slug}`}>{a.title}</Link></h2><p>{a.summary}</p><small>{a.author} · <time dateTime={a.publishedAt}>{new Date(a.publishedAt).toLocaleDateString('en-GB',{dateStyle:'long',timeZone:'UTC'})}</time></small></article>)}</div>:<p className="insights-empty">Our Insights &amp; Analysis section is being prepared. No long-form articles have been approved for publication yet. For current coverage, visit the <Link href="/signals">Signal Feed</Link>.</p>}</main>;
}
