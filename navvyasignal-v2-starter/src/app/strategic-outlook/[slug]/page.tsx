import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {outlookSections,outlookPreviewEnabled} from '@/lib/strategicOutlook';
import styles from '../strategicOutlook.module.css';
import {outlookNoIndex} from '@/lib/strategicOutlookSeo';
export const dynamicParams=false;
export function generateStaticParams(){return outlookSections.map(({slug})=>({slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const section=outlookSections.find(s=>s.slug===slug);return {title:section?.title??'Strategic Outlook',description:section?.summary,robots:outlookNoIndex,openGraph:{type:'article',siteName:'NavvyaSignal',title:section?.title??'Strategic Outlook',description:section?.summary,locale:'en_US'},twitter:{card:'summary',title:section?.title??'Strategic Outlook',description:section?.summary}};}
export default async function OutlookSectionPage({params}:{params:Promise<{slug:string}>}){
 if(!outlookPreviewEnabled()) notFound();
 const {slug}=await params;const section=outlookSections.find(s=>s.slug===slug);
 if(!section) notFound();
 const idx=outlookSections.findIndex(s=>s.slug===section.slug);
 return <main className={styles.wrap}><article className={styles.inner}>
 <p className={styles.eyebrow}>NAVVYASIGNAL · STRATEGIC OUTLOOK 2027–2030 · {section.label}</p>
 <h1>{section.title}</h1><p className={styles.lede}>{section.summary}</p>
 <p className={styles.hold}>EDITORIAL HOLD — Full article is retained in the offline editorial package pending factual checks and explicit approval. This route does not publish the manuscript.</p>
 <nav className={styles.sectionNav} aria-label="Series navigation"><Link href="/strategic-outlook">All sections</Link>{idx>0&&<Link href={`/strategic-outlook/${outlookSections[idx-1].slug}`}>Previous</Link>}{idx<outlookSections.length-1&&<Link href={`/strategic-outlook/${outlookSections[idx+1].slug}`}>Next</Link>}</nav>
 </article></main>;
}
