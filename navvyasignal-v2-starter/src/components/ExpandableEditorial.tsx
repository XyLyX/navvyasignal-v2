'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type EditorialPreview = { id: string; title: string; brief: string; category?: string };
export default function ExpandableEditorial({ story, label, className = '' }: { story: EditorialPreview; label?: string; className?: string }) {
 const [open, setOpen] = useState(false);
 const ref = useRef<HTMLElement>(null);
 useEffect(() => {
  if (!open) return;
  const outside = (event: PointerEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
  const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
  document.addEventListener('pointerdown', outside);
  document.addEventListener('keydown', escape);
  return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
 }, [open]);
 return <article ref={ref} className={`editorial-expandable ${className} ${open ? 'is-open' : ''}`}>
  {label && <span className="kicker">{label}</span>}
  <h3><Link href={`/signals/${story.id}`}>{story.title}</Link></h3>
  <p className="editorial-preview-text">{story.brief}</p>
  <div className="editorial-preview-actions">
   <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Show less ↑' : 'Highlights · Read more ↓'}</button>
   <Link href={`/signals/${story.id}`}>Full report ↗</Link>
  </div>
 </article>;
}
