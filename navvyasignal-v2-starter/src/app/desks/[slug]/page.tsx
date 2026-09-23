import { notFound } from 'next/navigation';
import { desks } from '@/lib/desks';
import { getStories } from '@/lib/notion';
export async function generateStaticParams(){return desks.map(d=>({slug:d.slug}));}
export default async function Desk({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const desk=desks.find(d=>d.slug===slug);if(!desk)notFound();const stories=(await getStories(100)).filter(s=>s.category===desk.notion);return <main className="container inner"><p className="eyebrow">INTELLIGENCE DESK</p><h1>{desk.name}</h1>{stories.map(s=><article className="story" key={s.id}><div><h3>{s.title}</h3><p>{s.brief}</p></div></article>)}{!stories.length&&<p className="empty">No matching stories in the preview batch yet.</p>}</main>}
