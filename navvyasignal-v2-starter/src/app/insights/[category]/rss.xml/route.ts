import {getInsights,makeRss,categorySlugs} from '@/lib/insights';
import {notFound} from 'next/navigation';
export const dynamic='force-static';
export function generateStaticParams(){return Object.keys(categorySlugs).map(category=>({category}));}
export async function GET(_:Request,{params}:{params:Promise<{category:string}>}){const {category}=await params;if(!categorySlugs[category])notFound();return new Response(makeRss(await getInsights(),category),{headers:{'Content-Type':'application/rss+xml; charset=utf-8','Cache-Control':'public, max-age=300'}});}
