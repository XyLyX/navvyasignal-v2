'use client';
import { useState } from 'react';
export default function ShareLinks({ title, url }: { title: string; url: string }) {
 const [copied, setCopied] = useState(false);
 const encoded = encodeURIComponent(url);
 const caption = encodeURIComponent(title);
 return <div className="article-share" aria-label="Share this report">
  <strong>Share</strong>
  <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`} target="_blank" rel="noopener noreferrer" aria-label="Share on LinkedIn">LinkedIn ↗</a>
  <a href={`https://twitter.com/intent/tweet?text=${caption}&url=${encoded}`} target="_blank" rel="noopener noreferrer" aria-label="Share on X">X ↗</a>
  <a href={`https://api.whatsapp.com/send?text=${caption}%20${encoded}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">WhatsApp ↗</a>
  <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(true); } catch { setCopied(false); } }}>{copied ? 'Link copied ✓' : 'Copy link'}</button>
 </div>;
}
