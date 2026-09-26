import type { Metadata } from 'next';
import Link from 'next/link';
import GlobalPulse from '@/components/GlobalPulse';
import { arabicDesks } from '@/lib/arabicDesks';
import { approvedArabicArticles, findApprovedArabicArticle } from '@/lib/arabicEditorial';
import { getStories } from '@/lib/notion';
import { dubaiPublicationDate } from '@/lib/homepageSelection';

export const metadata: Metadata = {
 title: 'نافيا سيغنال | قراءة مستقلة في الشؤون العالمية',
 description: 'تغطية مستقلة للتطورات العالمية وسياقاتها، بإصدار عربي يُحرر ويُراجع بلغته الأصلية.',
 robots: {index:false,follow:false},
};
export default async function ArabicHome() {
 const stories = await getStories();
 const today = dubaiPublicationDate();
 const reports = approvedArabicArticles.filter(a => findApprovedArabicArticle(a.id) && a.publishedAt.slice(0,10) === today);
 const watchCount = stories.filter(s => s.watchlist && s.watchStatus === 'Active').length;
 return <main lang="ar" dir="rtl" className="arabic-edition arabic-home">
 <GlobalPulse locale="ar" />
 <section className="arabic-hero"><div className="container">
 <p className="arabic-kicker">الشؤون العالمية · تحليل مستقل</p>
 <h1>افهم ما يهم.<br/><em>واكتشف ما يربط الأحداث.</em></h1>
 <p>تغطية مستقلة تستند إلى الوقائع الموثقة، وتضع الأحداث في سياقها، وتكشف الصلات بين السياسة والاقتصاد والتكنولوجيا والتجارة.</p>
 <p className="arabic-hero-note">سبعة أقسام · تقارير راهنة · متابعة التطورات</p>
 </div></section>
 <div className="container arabic-news-layout">
 <section aria-labelledby="arabic-today-title">
 <div className="arabic-section-title"><h2 id="arabic-today-title">أبرز التطورات اليوم</h2><Link href="/ar/signals">جميع التقارير ←</Link></div>
 <p className="arabic-section-deck">تقارير أُعدّت بالعربية وخضعت للمراجعة التحريرية، بحسب تاريخ النشر في دبي.</p>
 {reports.length ? reports.map(a => <article className="arabic-story" key={a.id}><span className="arabic-kicker">{arabicDesks.find(d=>d.slug===a.deskSlug)?.title ?? 'تقرير'}</span><h3><Link href={`/ar/signals/${a.id}`}>{a.title}</Link></h3><p>{a.deck}</p></article>) :
 <div className="arabic-editorial-empty"><span className="arabic-kicker">العدد العربي قيد الإعداد</span><h3>نعمل على تقارير اليوم</h3><p>لم تُعتمد بعد تقارير عربية بتاريخ اليوم. لا نعرض ترجمات آلية أو مواد قديمة على أنها أخبار جديدة.</p><Link href="/signals" hrefLang="en">الاطلاع على أحدث التقارير بالإنجليزية ←</Link></div>}
 </section>
 <aside className="arabic-watch" aria-labelledby="arabic-watch-title">
 <div className="arabic-section-title"><h2 id="arabic-watch-title">قائمة المتابعة</h2></div>
 <p>ملفات نتابع تطوراتها ونراجع مستجداتها باستمرار.</p>
 <div className="arabic-watch-panel"><span className="arabic-kicker">ملفات قيد المتابعة</span><strong>{watchCount.toLocaleString('ar-AE')}</strong><p>تتوفر التفاصيل حالياً بالإنجليزية إلى حين إعداد التغطية العربية المعتمدة.</p><Link href="/watchlist" hrefLang="en">عرض قائمة المتابعة ←</Link></div>
 </aside></div>
 <section id="desks-ar" className="arabic-desks"><div className="container arabic-section">
 <div className="arabic-section-title"><h2>الأقسام السبعة</h2></div>
 <div className="arabic-desk-grid">{arabicDesks.map((d,i)=><Link key={d.slug} href={`/ar/desks/${d.slug}`} className="arabic-desk-card"><span className="arabic-desk-number">{String(i+1).padStart(2,'0')}</span><h3>{d.title}</h3><p>{d.summary}</p><strong>استكشف القسم ←</strong></Link>)}</div>
 </div></section>
 <section className="container arabic-section arabic-editorial-formats"><div className="arabic-section-title"><h2>ما وراء الخبر</h2></div>
 <div className="arabic-format-grid"><article><span className="arabic-kicker">تحليل مشترك</span><h3>كيف تتصل الأحداث؟</h3><p>قراءة في الروابط بين المناطق والأسواق والتكنولوجيا وسلاسل الإمداد.</p></article><article><span className="arabic-kicker">إحاطة أسبوعية</span><h3>الأسبوع في سياقه</h3><p>ملخص تحليلي لأهم التطورات بعد إقراره تحريرياً.</p></article><article><span className="arabic-kicker">قراءات معمقة</span><h3>أبعد من العناوين</h3><p>تقارير مطولة تستند إلى مصادر موثقة وتوضح ما نعرفه وما لا نعرفه بعد.</p></article></div>
 <p className="arabic-editorial-note">هذه الأشكال التحريرية قيد الإعداد، ولن تُنشر قبل المراجعة.</p>
 </section>
 </main>;
