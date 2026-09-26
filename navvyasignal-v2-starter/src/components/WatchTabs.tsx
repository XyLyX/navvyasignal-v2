'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import WatchCard, { type WatchEntry } from './WatchCard';
import { nextTabIndex } from '@/lib/tabNav';

export type WatchTab = { id: 'active' | 'resolved'; label: string; entries: WatchEntry[] };

/**
 * Accessible Active / Resolved tabs (WAI-ARIA tabs pattern): roving tabindex, Left/Right/Home/End keys, automatic
 * activation, one visible panel. The selected tab is shown with weight, a thick underline and aria-selected, never
 * by colour alone. Counts come from the records passed in.
 */
export default function WatchTabs({ tabs }: { tabs: WatchTab[] }) {
  const [selected, setSelected] = useState<WatchTab['id']>(tabs[0].id);
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Deep link: /watchlist#resolved opens the Resolved tab.
  useEffect(() => {
    const apply = () => {
      const fromHash = window.location.hash.replace('#', '');
      if (tabs.some(t => t.id === fromHash)) setSelected(fromHash as WatchTab['id']);
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, [tabs]);

  const choose = (id: WatchTab['id'], focus = false) => {
    setSelected(id);
    if (focus) refs.current[id]?.focus();
    try { window.history.replaceState(null, '', `#${id}`); } catch { /* non-critical */ }
  };
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const next = nextTabIndex(e.key, index, tabs.length);
    if (next < 0) return;
    e.preventDefault();
    choose(tabs[next].id, true);
  };

  return <div className="watch-tabs">
    <div role="tablist" aria-label="Watchlist status" className="watch-tablist">
      {tabs.map((t, i) => {
        const on = t.id === selected;
        return <button key={t.id} type="button" role="tab" id={`watch-tab-${t.id}`} aria-selected={on} aria-controls={`watch-panel-${t.id}`}
          tabIndex={on ? 0 : -1} className={`watch-tab watch-tab-${t.id}`} ref={el => { refs.current[t.id] = el; }}
          onClick={() => choose(t.id)} onKeyDown={e => onKeyDown(e, i)}>
          <span className="watch-tab-label">{t.label}</span>
          <span className="watch-count" aria-label={`${t.entries.length} entries`}>{t.entries.length}</span>
        </button>;
      })}
    </div>
    {tabs.map(t => <div key={t.id} role="tabpanel" id={`watch-panel-${t.id}`} aria-labelledby={`watch-tab-${t.id}`} hidden={t.id !== selected} tabIndex={0} className="watch-tabpanel">
      {t.id === selected
        ? (t.entries.length
          ? <div className="watch-grid">{t.entries.map(s => <WatchCard key={s.id} story={s} variant="page" />)}</div>
          : <p className="empty">No approved {t.label.toLowerCase()} Watchlist entries.</p>)
        : null}
    </div>)}
  </div>;
}
