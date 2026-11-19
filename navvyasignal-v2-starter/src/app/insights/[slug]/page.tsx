import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {getInsights,articleUrl} from '@/lib/insights';
type Props={params:Promise<{slug:string}>};
// Next's static export rejects an empty generateStaticParams(). With no published articles we emit one placeholder that can never be a real
// slug (real slugs are lowercase alphanumerics and hyphens) and that always resolves to a 404 with noindex metadata.
const PLACEHOLDER_SLUG='__no-published-insights__';
export async function generateStaticParams(){const articles=await getInsights();return articles.length?articles.map(a=>({slug:a.slug})):[{slug:PLACEHOLDER_SLUG}];}
export async function generateMetadata({params}:Props):Promise<Metadata>{
 const {slug}=await params;const a=(await getInsights()).find(x=>x.slug===slug);if(!a)return {title:'Article not found',robots:{index:false,follow:false}};
 return {title:a.seoTitle||a.title,description:a.seoDescription||a.summary,alternates:{canonical:articleUrl(slug),types:{'application/rss+xml':'/insights/rss.xml'}},openGraph:{type:'article',title:a.seoTitle||a.title,description:a.seoDescription||a.summary,url:articleUrl(slug),publishedTime:a.publishedAt,modifiedTime:a.modifiedAt,authors:[a.author],images:a.heroImage?[{url:a.heroImage,alt:a.heroAlt||a.title}]:undefined},twitter:{card:a.heroImage?'summary_large_image':'summary'}};
}
export default async function InsightArticle({params}:Props){
 const {slug}=await params;const a=(await getInsights()).find(x=>x.slug===slug);if(!a)notFound();
 const schema={'@context':'https://schema.org','@type':'Article',headline:a.title,description:a.summary,datePublished:a.publishedAt,dateModified:a.modifiedAt,mainEntityOfPage:articleUrl(slug),inLanguage:'en',articleSection:a.category,author:{'@type':'Person',name:a.author},publisher:{'@type':'Organization',name:'NavvyaSignal',url:'https://navvyasignal.com'},...(a.heroImage?{image:a.heroImage}:{})};
 return <main className="container inner insight-article"><nav aria-label="Breadcrumb"><Link href="/">Home</Link> / <Link href="/insights">Insights &amp; Analysis</Link> / {a.category}</nav><article><header><p className="eyebrow">{a.category} · {a.desk}</p><h1>{a.title}</h1><p className="insight-dek">{a.subtitle||a.summary}</p><p>By {a.author} · <time dateTime={a.publishedAt}>{new Date(a.publishedAt).toLocaleDateString('en-GB',{dateStyle:'long',timeZone:'UTC'})}</time></p></header>{a.heroImage&&<figure><img src={a.heroImage} alt={a.heroAlt||''} loading="eager"/>{a.heroAlt&&<figcaption>{a.heroAlt}</figcaption>}</figure>}<div className="insight-body">{a.body.map((paragraph,i)=><p key={i}>{paragraph}</p>)}</div><section aria-label="Sources"><h2>Sources and references</h2><ul>{a.sources.map((s,i)=><li key={i}><a href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul></section><p><Link href="/insights">← All insights</Link></p></article><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/></main>;
}
