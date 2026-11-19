import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {outlookSections,outlookYears,outlookPreviewEnabled} from '@/lib/strategicOutlook';
import {OutlookNavigation} from './OutlookNavigation';
import styles from './strategicOutlook.module.css';
import {outlookDescription,outlookSeriesTitle,outlookNoIndex} from '@/lib/strategicOutlookSeo';
export const metadata:Metadata={title:outlookSeriesTitle+' — Private Editorial Preview',description:outlookDescription,robots:outlookNoIndex,openGraph:{type:'website',siteName:'NavvyaSignal',title:outlookSeriesTitle,description:outlookDescription,locale:'en_US'},twitter:{card:'summary',title:outlookSeriesTitle,description:outlookDescription}};
export default function StrategicOutlookPage(){
 if(!outlookPreviewEnabled()) notFound();
 return <main className={styles.wrap}><div className={styles.inner}>
 <OutlookNavigation />
 <p className={styles.eyebrow}>NAVVYASIGNAL · INDEPENDENT STRATEGIC RESEARCH · PRIVATE STAGING</p>
 <h1>Strategic Outlook <span>2027–2030</span></h1>
 <p className={styles.lede}>Ten original editorial sections establish the 2027 baseline. Annual reviews will track the evidence, compare forecasts with outcomes and preserve the original dated assessments.</p>
 <p className={styles.hold}>EDITORIAL HOLD — Manuscripts are not approved for publication. Private editorial review.</p>
 <img className={styles.hero} src="/strategic-outlook/strategic-outlook-cover.webp" alt="Earth at sunrise with glowing connections between continents" width={1086} height={724} />
 <div className={styles.yearGrid}>{outlookYears.map((y,i)=><div key={y}><strong>{y}</strong><small>{i===0?'Original baseline':i===3?'Final assessment':'Annual comparison'}</small></div>)}</div>
 <h2>2027 baseline edition</h2>
 <div className={styles.cards}>{outlookSections.map(s=><Link key={s.slug} href={`/strategic-outlook/${s.slug}`} className={styles.card}><p>{s.label}</p><h3>{s.title}</h3><span>{s.summary}</span></Link>)}</div>
 <p className={styles.note}>This is a separate editorial stream. The Signal Feed and Insights &amp; Analysis retain their existing publishing controls and data stores. The Economist cover is a third-party reference and must not be publicly reproduced without appropriate rights.</p>
 </div></main>;
}
