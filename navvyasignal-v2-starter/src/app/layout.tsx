import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
export const metadata: Metadata = { title: { default: 'NavvyaSignal — Global Intelligence', template: '%s | NavvyaSignal' }, description: 'Independent global intelligence, analysis and cross-desk reporting.', robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="en"><body><header className="mast"><div className="container"><Link href="/" className="brand">NAVVYA<span>SIGNAL</span><small>INDEPENDENT GLOBAL INTELLIGENCE</small></Link><nav><Link href="/signals">Signals</Link><Link href="/watchlist">Watchlist</Link><a href="/#desks">Desks</a></nav></div></header>{children}<footer className="footer"><div className="container">NavvyaSignal V2 · Private preview · Production remains on Framer</div></footer></body></html>;
}
