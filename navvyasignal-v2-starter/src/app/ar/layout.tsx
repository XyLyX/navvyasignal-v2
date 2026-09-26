import Link from 'next/link';
export default function ArabicLayout({children}:{children:React.ReactNode}) {
 return <div className="arabic-shell" lang="ar" dir="rtl">
 <header className="arabic-mast"><div className="container arabic-topbar">
 <Link href="/ar" className="arabic-wordmark">NAVVYASIGNAL <small>النسخة العربية</small></Link>
 <nav aria-label="التنقل في النسخة العربية"><Link href="/ar/signals">التقارير</Link><Link href="/ar#desks-ar">الأقسام</Link><Link href="/ar/about">من نحن</Link>
 <span className="language-switch" dir="ltr"><Link href="/" hrefLang="en" lang="en">English</Link><span aria-hidden="true">|</span><span lang="ar" aria-current="page">العربية</span></span>
 </nav></div></header>{children}
 <footer className="arabic-footer"><div className="container"><span>نافيا سيغنال — النسخة العربية</span><a href="mailto:hello@navvyasignal.com" dir="ltr">hello@navvyasignal.com</a></div></footer>
 </div>;
}