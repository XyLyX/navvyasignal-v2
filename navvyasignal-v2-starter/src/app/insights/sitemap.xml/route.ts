import {getInsights,articleUrl} from '@/lib/insights';
export const dynamic='force-static';
export async function GET(){const articles=await getInsights();const xml='<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://navvyasignal.com/insights</loc></url>'+articles.map(a=>'<url><loc>'+articleUrl(a.slug)+'</loc><lastmod>'+new Date(a.modifiedAt).toISOString()+'</lastmod></url>').join('')+'</urlset>';return new Response(xml,{headers:{'Content-Type':'application/xml; charset=utf-8'}});}
