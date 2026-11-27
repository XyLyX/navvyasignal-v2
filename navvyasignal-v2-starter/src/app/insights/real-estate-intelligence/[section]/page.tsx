import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sections } from '../sections';
const root = '/insights/real-estate-intelligence';
type Props = { params: Promise<{section:string}> };
export const dynamicParams = false;
export function generateStaticParams(){return sections.map(([section])=>({section}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {section}=await params;const item=sections.find(([id])=>id===section);return {title:item?.[1] ?? 'Research preview',description:item?.[2],robots:{index:false,follow:false}};}
export default async function SectionPage({params}:Props){const {section}=await params;const i=sections.findIndex(([id])=>id===section);if(i<0)notFound();const [,title,body]=sections[i];return <main className="container inner signal-feed-page"><header className="intelligence-page-hero"><p className="eyebrow">NS-REI-001 · SECTION {i+1} · DRAFT</p><h1>{title}</h1><p>Research preview — independent verification pending.</p></header><article><p>{body}</p></article><nav aria-label="Research navigation"><p><Link href={root}>Complete edition</Link></p>{i>0&&<p><Link href={root+'/'+sections[i-1][0]}>Previous: {sections[i-1][1]}</Link></p>}{i<sections.length-1&&<p><Link href={root+'/'+sections[i+1][0]}>Next: {sections[i+1][1]}</Link></p>}</nav></main>;}
