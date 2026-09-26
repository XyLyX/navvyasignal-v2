import Link from 'next/link';
import JoinForm from '@/components/JoinForm';

export const metadata = { title: 'Join Our Network', description: 'Introduce your publication or business to the Navvya Network.' };

export default function JoinNetwork() {
  return <main className="container inner network-page join-page">
    <p className="eyebrow">THE NAVVYA NETWORK</p>
    <h1>Join Our Network</h1>
    <p className="intro">Run a publication or a business you would like to see in the Navvya Network? Tell us about yourself and what you publish.</p>
    <div id="join-note" className="join-preview-note" role="note">
      Your enquiry is sent through our hosting provider&rsquo;s form service to the NavvyaSignal team. No automatic confirmation email is sent. You can also email <a href="mailto:hello@navvyasignal.com">hello@navvyasignal.com</a> or use the <Link href="/contact">contact page</Link>.
    </div>
    <JoinForm />
    <p className="join-fine">Network listings are separate from NavvyaSignal’s intelligence reporting and are not editorial endorsements.</p>
    <p><Link href="/network">← Back to the Navvya Network</Link></p>
  </main>;
}
