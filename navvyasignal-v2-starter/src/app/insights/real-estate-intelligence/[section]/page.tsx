import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sections } from '../sections';
const root = '/insights/real-estate-intelligence';
type Props = { params: Promise<{section:string}> };
export const dynamicParams = false;
export function generateStaticParams(){return sections.map(([section])=>({section}));}
export async function generateMetadata({params}:Props):Promise<Metadata>{const {section}=await params;const item=sections.find(([id])=>id===section);if(!item)return {title:'Research preview',robots:{index:false,follow:false}};const description=item[2].split('. ')[0].slice(0,155);return {title:item[1]+' — Real Estate Intelligence',description,alternates:{canonical:root+'/'+section},openGraph:{title:item[1],description,type:'article',url:root+'/'+section},robots:{index:false,follow:false}};}
export default async function SectionPage({params}:Props){const {section}=await params;const i=sections.findIndex(([id])=>id===section);if(i<0)notFound();const [,title,body]=sections[i];return <main className="container inner signal-feed-page"><header className="intelligence-page-hero"><p className="eyebrow">NS-REI-001 · SECTION {i+1} · DRAFT</p><h1>{title}</h1><p>Research preview — independent verification pending.</p></header><article>{body.split('\n\n').map((paragraph,index)=>paragraph.startsWith('## ')?<div key={index}>{paragraph.split('\n').map((line,j)=>j===0?<h3 key={j}>{line.slice(3)}</h3>:<p key={j}>{line}</p>)}</div>:<p key={index}>{paragraph}</p>)}</article><nav aria-label="Research navigation"><p><Link href={root}>Complete edition</Link></p>{i>0&&<p><Link href={root+'/'+sections[i-1][0]}>Previous: {sections[i-1][1]}</Link></p>}{i<sections.length-1&&<p><Link href={root+'/'+sections[i+1][0]}>Next: {sections[i+1][1]}</Link></p>}</nav></main>;}
