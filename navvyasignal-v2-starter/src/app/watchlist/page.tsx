import type { Metadata } from 'next';
import { getStories } from '@/lib/notion';
export const metadata: Metadata = { title: 'Watchlist' };
export default async function Watchlist(){ const stories=(await getStories(100)).filter(s=>s.watchlist);return <main className="container inner"><p className="eyebrow">ONGOING INTELLIGENCE</p><h1>Watchlist</h1><p>Tracked situations, not ordinary breaking-news labels.</p>{stories.map(s=><article className="story" key={s.id}><div><span className="status">{s.watchStatus||'Unspecified'}</span><h3>{s.title}</h3><p>{s.brief}</p>{s.nextReview&&<small>Next review: {s.nextReview}</small>}</div></article>)}</main> }
