import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Old Archives — Version 1',
  description: 'Access the original NavvyaSignal archive for historical reference.',
  robots: { index: false, follow: true },
};

export default function OldArchivesPage() {
  return <main className="container inner info-page">
    <p className="eyebrow">HISTORICAL REFERENCE</p>
    <h1>Old Archives — Version 1</h1>
    <p className="info-lede">The original NavvyaSignal reporting archive is preserved separately for reference. These historical articles are not updated and should not be mistaken for current intelligence.</p>
    <section>
      <h2>Browse the original archive</h2>
      <p>The existing V1 site retains its original article pages. Search and browse there using its existing facilities; no historical articles have been rebuilt for V2.</p>
      <p><a href="https://other-transform-191815.framer.app/" rel="noopener noreferrer">Open Old Archives — Version 1 ↗</a></p>
      <p><small>Temporary Framer address while the archive subdomain is configured. Verify individual historical article URLs before the production switch.</small></p>
    </section>
  </main>;
}
