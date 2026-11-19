import Link from 'next/link';
import {outlookSections} from '@/lib/strategicOutlook';
import styles from './strategicOutlook.module.css';

export function OutlookNavigation({current}: {current?: string}) {
 return (
  <nav className={styles.outlookNavigation} aria-label="Strategic Outlook sections">
   <Link href="/strategic-outlook" aria-current={current ? undefined : 'page'}>
    {current ? '← Strategic Outlook' : 'Strategic Outlook'}
   </Link>
   {outlookSections.map(({slug,label})=>(
    <Link key={slug} href={`/strategic-outlook/${slug}`} aria-current={current===slug ? 'page' : undefined}>
     {label}
    </Link>
   ))}
  </nav>
 );
}
