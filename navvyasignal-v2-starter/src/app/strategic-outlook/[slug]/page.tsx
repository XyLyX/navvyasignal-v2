import {getPublishedOutlook, outlookArtworkPath, outlookArticleUrl} from '@/lib/strategicOutlookPublication';
import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {outlookSections,outlookPreviewEnabled} from '@/lib/strategicOutlook';
import {outlookManuscript} from '@/lib/strategicOutlookManuscript';
import {OutlookNavigation} from '../OutlookNavigation';
import styles from '../strategicOutlook.module.css';
import {outlookNoIndex} from '@/lib/strategicOutlookSeo';
export const dynamicParams=false;
export function generateStaticParams(){return outlookSections.map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug} = await params;
 const entry = getPublishedOutlook().find(item => item.slug === slug);
 if (!entry) {
  if (!outlookPreviewEnabled()) return {title:'Strategic Outlook',robots:outlookNoIndex};
  const section = outlookSections.find(item => item.slug === slug);
  return {title:section?.title,description:section?.summary,robots:outlookNoIndex};
 }
 const image = {url:outlookArtworkPath(slug),alt:entry.imageAlt};
 const canonical = outlookArticleUrl(slug);
 return {title:entry.title,description:entry.summary,robots:{index:true,follow:true},
  alternates:{canonical},openGraph:{type:'article',url:canonical,title:entry.title,
   description:entry.summary,publishedTime:entry.publishedAt,images:[image]},
  twitter:{card:'summary_large_image',title:entry.title,description:entry.summary,images:[image]}};
}
export default async function OutlookSectionPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const preview = outlookPreviewEnabled();
 const entry = getPublishedOutlook().find(item => item.slug === slug);
 const section = outlookSections.find(item => item.slug === slug);
 if (!section || (!preview && !entry)) notFound();
 const manuscript = entry ? entry.body : outlookManuscript(section);
 const idx=outlookSections.findIndex(s=>s.slug===section.slug);
 return <main className={styles.wrap}><article className={styles.inner}>
 <OutlookNavigation current={slug} />
 <p className={styles.eyebrow}>NAVVYASIGNAL · STRATEGIC OUTLOOK 2027–2030</p>
 {entry && <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({
  '@context':'https://schema.org','@type':'Article',headline:entry.title,description:entry.summary,
  url:outlookArticleUrl(slug),datePublished:entry.publishedAt,
  image:new URL(outlookArtworkPath(slug),outlookArticleUrl(slug)).href,
  author:{'@type':'Organization',name:'NavvyaSignal'},publisher:{'@type':'Organization',name:'NavvyaSignal'},
  citation:entry.sources,
 }).replace(/</g,'\\u003c')}} />}
 <h1>{entry?.title ?? section.title}</h1><p className={styles.lede}>{entry?.summary ?? section.summary}</p>
 {preview && <p className={styles.hold}>EDITORIAL HOLD — Private editorial review. Fact-checking and approval are pending.</p>}
 <img className={styles.hero} src={entry ? outlookArtworkPath(slug) : section.asset} alt={entry?.imageAlt ?? section.alt} />
 {preview && slug==='opening' && <p className={styles.note}>Editorial reference supplied for private review. Cover graphic references The Economist’s <cite>The World Ahead 2027</cite>.</p>}
 <div className={styles.manuscript} dangerouslySetInnerHTML={{__html:manuscript}} />
 {entry && <section aria-label="Sources" className={styles.manuscript}><h2>Sources</h2><ul>
  {entry.sources.map(url => <li key={url}><a href={url}>{new URL(url).hostname}</a></li>)}
 </ul></section>}
 <nav className={styles.sectionNav} aria-label="Series navigation"><Link href="/strategic-outlook">All sections</Link>{idx>0&&<Link href={`/strategic-outlook/${outlookSections[idx-1].slug}`} rel="prev">{outlookSections[idx-1].label}</Link>}{idx<outlookSections.length-1&&<Link href={`/strategic-outlook/${outlookSections[idx+1].slug}`} rel="next">{outlookSections[idx+1].label}</Link>}</nav>
 </article></main>;
}
