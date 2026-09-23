'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type ArchiveItem = { id: string; title: string; brief: string; category: string; createdAt: string };
const PAGE_SIZE = 20;
const DESKS = [
  { label: 'West Asia', categories: ['West Asia Desk'] },
  { label: 'India', categories: ['India Desk'] },
  { label: 'UAE', categories: ['UAE Desk'] },
  { label: 'Global Politics', categories: ['Global Politics Desk'] },
  { label: 'Markets & Capital', categories: ['Markets & Capital Desk'] },
  { label: 'Technology & AI', categories: ['Technology & AI Desk'] },
  { label: 'Maritime, Energy & Supply Chains', categories: ['Maritime & Energy Desk', 'Maritime Energy & Supply Chains Desk'] },
];
export default function ArchiveExplorer({ stories }: { stories: ArchiveItem[] }) {
  const [query, setQuery] = useState('');
  const [desk, setDesk] = useState('');
  const [month, setMonth] = useState('');
  const [page, setPage] = useState(1);
  const months = useMemo(() => Array.from(new Set(stories.map(s => s.createdAt.slice(0, 7)).filter(Boolean))).sort().reverse(), [stories]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return stories.filter(s => {
      if (needle && ![s.title, s.brief, s.category].some(v => v.toLocaleLowerCase().includes(needle))) return false;
      if (desk === 'other') {
        if (DESKS.some(d => d.categories.includes(s.category))) return false;
      } else if (desk && !DESKS.find(d => d.label === desk)?.categories.includes(s.category)) return false;
      return !month || s.createdAt.slice(0, 7) === month;
    });
  }, [stories, query, desk, month]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shown = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function resetFilters() { setQuery(''); setDesk(''); setMonth(''); setPage(1); }
  return <section className="archive-explorer" aria-label="Explore historical signals">
    <div className="archive-controls">
      <label>Search historical signals
        <input type="search" value={query} onChange={e => {setQuery(e.target.value); setPage(1);}} placeholder="Search headlines and briefs" />
      </label>
      <label>Intelligence desk
        <select value={desk} onChange={e => {setDesk(e.target.value); setPage(1);}}>
          <option value="">All desks</option>
          {DESKS.map(d => <option key={d.label} value={d.label}>{d.label}</option>)}
          <option value="other">Other legacy categories</option>
        </select>
      </label>
      <label>Notion record creation month
        <select value={month} onChange={e => {setMonth(e.target.value); setPage(1);}}>
          <option value="">All months</option>
          {months.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>
    </div>
    <div className="archive-summary" aria-live="polite">
      <span>{filtered.length} historical {filtered.length === 1 ? 'signal' : 'signals'} found · Page {currentPage} of {totalPages}</span>
      <button type="button" onClick={resetFilters}>Clear filters</button>
    </div>
    {shown.map(s => <article className="story" key={s.id}><div>
      <span className="kicker">{s.category || 'Uncategorized'} · Notion record: {s.createdAt.slice(0, 10)}</span>
      <h3><Link href={`/signals/${s.id}`}>{s.title}</Link></h3>
      {s.brief && <p>{s.brief}</p>}
    </div></article>)}
    {!filtered.length && <p className="empty">No historical signals match these filters.</p>}
    {totalPages > 1 && <nav className="archive-pagination" aria-label="Archive pages">
      <button type="button" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</button>
      <span>Page {currentPage} of {totalPages}</span>
      <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</button>
    </nav>}
  </section>;
}
