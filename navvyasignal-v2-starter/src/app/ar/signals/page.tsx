import type { Metadata } from 'next';
import Link from 'next/link';
import { approvedArabicArticles } from '@/lib/arabicEditorial';
export const metadata: Metadata = {title:'التقارير | نافيا سيغنال',description:'تقارير محررة باللغة العربية بعد المراجعة التحريرية.',robots:{index:false,follow:false}};
export default function ArabicSignals(){
 const published=approvedArabicArticles.filter(a=>a.reviewedBy.trim() && a.title.trim() && a.paragraphs.length && a.sourceLinks.length);
 return <main lang="ar" dir="rtl" className="arabic-edition container arabic-section">
 <nav aria-label="مسار الصفحة"><Link href="/ar">الرئيسية</Link> / التقارير</nav>
 <h1>التقارير</h1><p>مواد صحفية تُكتب بالعربية وتخضع للمراجعة التحريرية قبل نشرها.</p>
 {published.length?published.map(a=><article className="story" key={a.id}><div><h2><Link href={`/ar/signals/${a.id}`}>{a.title}</Link></h2><p>{a.deck}</p></div></article>):<div className="arabic-notice"><h2>لم تُنشر مواد عربية بعد</h2><p>نعمل على إعداد الإصدار العربي. لن نعرض ترجمات آلية أو تقارير غير معتمدة لملء هذه الصفحة.</p><Link href="/signals" hrefLang="en">تصفح التقارير المتاحة بالإنجليزية</Link></div>}
 </main>;
}