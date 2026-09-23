import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
export const metadata: Metadata = { title: 'Signals' };
export default async function Signals(){ const stories=await getStories(100);return <main className="container inner"><p className="eyebrow">THE ARCHIVE</p><h1>Signal Feed</h1><p>Preview inventory. Legacy URLs will be reconciled before production cutover.</p>{stories.map(s=><article className="story" key={s.id}><div><span className="kicker">{s.category}</span><h3>{s.title}</h3><p>{s.brief}</p></div></article>)}</main> }
