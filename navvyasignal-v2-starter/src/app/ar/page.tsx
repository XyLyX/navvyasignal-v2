import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'نافيا سيغنال | قراءة في الأحداث وما وراءها',
  description: 'نافيا سيغنال: تغطية وتحليل للتطورات العالمية، مع الاهتمام بسياق الأحداث وترابطها.',
  robots: { index: false, follow: false },
  alternates: { languages: { 'en': '/', 'ar': '/ar' } },
};

const desks = [
  ['west-asia', 'غرب آسيا', 'التطورات السياسية والأمنية والاقتصادية في المنطقة.'],
  ['india', 'الهند', 'السياسات والاقتصاد والتحولات التي تتجاوز حدود الهند.'],
  ['uae', 'الإمارات', 'القرارات والتحولات الاقتصادية والإقليمية في دولة الإمارات.'],
  ['global-politics', 'الشؤون الدولية', 'مواقف الدول والعلاقات الدولية وتداعيات القرارات السياسية.'],
  ['markets-capital', 'الأسواق ورأس المال', 'حركة الأسواق والتمويل والعوامل المؤثرة في القرارات الاقتصادية.'],
  ['technology-ai', 'التكنولوجيا والذكاء الاصطناعي', 'التطورات التقنية وتأثيراتها الاقتصادية والمجتمعية والتنظيمية.'],
  ['maritime-energy-supply-chains', 'الملاحة والطاقة وسلاسل الإمداد', 'طرق التجارة وتدفقات الطاقة والاضطرابات التي تؤثر في الإمدادات.'],
] as const;

export default function ArabicHome() {
  return <div lang="ar" dir="rtl" className="arabic-edition">
    <header className="arabic-mast">
      <div className="container arabic-topbar">
        <Link href="/ar" className="arabic-wordmark">NAVVYASIGNAL <small>النسخة العربية</small></Link>
        <nav aria-label="التنقل في النسخة العربية"><a href="#today">أبرز التطورات</a><a href="#desks-ar">الأقسام</a><Link href="/ar/about">من نحن</Link><Link href="/" hrefLang="en" lang="en">English</Link></nav>
      </div>
    </header>
    <main>
      <section className="arabic-hero"><div className="container">
        <p className="arabic-kicker">قراءة مستقلة في الشؤون العالمية</p>
        <h1>ما الذي يحدث؟<br/><em>ولماذا يهم؟</em></h1>
        <p>نضع التطورات في سياقها، ونتتبع الصلات بين السياسة والاقتصاد والتكنولوجيا والتجارة، لنقدم صورة أوضح لما يجري وما قد يترتب عليه.</p>
      </div></section>
      <section id="today" className="container arabic-section" aria-labelledby="today-heading">
        <h2 id="today-heading">أبرز التطورات</h2>
        <div className="arabic-notice"><h3>النسخة العربية قيد الإعداد التحريري</h3>
          <p>لن ننشر هنا نصوصاً مترجمة آلياً بوصفها مواد صحفية عربية. ستظهر التقارير بعد صياغتها بالعربية ومراجعة الأسماء والأرقام والمصطلحات والمصادر.</p>
          <p>يمكن متابعة التغطية المتاحة حالياً في <Link href="/signals" hrefLang="en">النسخة الإنجليزية</Link>.</p>
        </div>
      </section>
      <section id="desks-ar" className="arabic-desks"><div className="container arabic-section">
        <h2>مجالات التغطية</h2><div className="arabic-desk-grid">{desks.map(([slug,title,summary])=>
          <article key={slug}><h3>{title}</h3><p>{summary}</p><Link href={`/ar/desks/${slug}`}>استكشف القسم ←</Link></article>
        )}</div>
      </div></section>
      <section id="about-ar" className="container arabic-section"><h2>عن نافيا سيغنال</h2>
        <p>نافيا سيغنال منصة مستقلة تُعنى بمتابعة التطورات العالمية وتحليل سياقاتها. نفرّق في تغطيتنا بين الوقائع الموثقة والتصريحات المنسوبة إلى أصحابها والتحليل والأسئلة التي لم تتضح إجاباتها بعد.</p>
        <p>نعدّ النسخة العربية لتكون إصداراً تحريرياً قائماً بذاته، بلغة صحفية عربية سليمة، لا نسخة حرفية من النص الإنجليزي.</p>
      </section>
    </main>
    <footer className="arabic-footer"><div className="container"><span>نافيا سيغنال — النسخة العربية</span><a href="mailto:hello@navvyasignal.com" dir="ltr">hello@navvyasignal.com</a><Link href="/" hrefLang="en" lang="en">English edition</Link></div></footer>
  </div>;
}
