import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { arabicDesks } from '@/lib/arabicDesks';
export const dynamicParams = false;
export function generateStaticParams(){return arabicDesks.map(d=>({slug:d.slug}));}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
 const {slug}=await params;const desk=arabicDesks.find(d=>d.slug===slug);
 return {title:desk?`${desk.title} | نافيا سيغنال`:'القسم غير متاح',description:desk?.summary,robots:{index:false,follow:false}};
}
export default async function ArabicDesk({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const desk=arabicDesks.find(d=>d.slug===slug);if(!desk)notFound();
 return <main lang="ar" dir="rtl" className="arabic-edition container arabic-section">
 <nav aria-label="مسار الصفحة"><Link href="/ar">الرئيسية</Link> / {desk.title}</nav>
 <h1>{desk.title}</h1><p className="info-lede">{desk.summary}</p>
 <div className="arabic-notice"><h2>التغطية العربية قيد الإعداد</h2>
 <p>ستُنشر هنا المواد التي كُتبت بالعربية وخضعت للمراجعة التحريرية. لن نعرض تقارير مترجمة آلياً أو مواد قديمة على أنها تغطية جديدة.</p>
 <p>للاطلاع على المواد المتاحة حالياً، تفضل بزيارة <Link href={`/desks/${slug}`} hrefLang="en">القسم باللغة الإنجليزية</Link>.</p></div>
 </main>;
}