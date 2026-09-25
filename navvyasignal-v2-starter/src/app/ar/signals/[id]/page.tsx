import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { approvedArabicArticles,findApprovedArabicArticle } from '@/lib/arabicEditorial';
export const dynamicParams=false;
export function generateStaticParams(){return approvedArabicArticles.filter(a=>findApprovedArabicArticle(a.id)).map(a=>({id:a.id}));}
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
 const {id}=await params;const a=findApprovedArabicArticle(id);
 return {title:a?`${a.title} | نافيا سيغنال`:'التقرير غير متاح',description:a?.deck,robots:{index:false,follow:false}};
}
export default async function ArabicArticle({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const a=findApprovedArabicArticle(id);if(!a)notFound();
 return <main lang="ar" dir="rtl" className="arabic-edition container arabic-section">
 <nav aria-label="مسار الصفحة"><Link href="/ar">الرئيسية</Link> / <Link href="/ar/signals">التقارير</Link></nav>
 <article><h1>{a.title}</h1><p className="info-lede">{a.deck}</p>
 <p><time dateTime={a.publishedAt}>{a.publishedAt}</time></p>
 {a.paragraphs.map((paragraph,i)=><p key={i}>{paragraph}</p>)}
 <section><h2>المصادر</h2><ul>{a.sourceLinks.map(link=><li key={link}><a href={link} rel="noopener noreferrer">{link}</a></li>)}</ul></section></article>
 </main>;
}