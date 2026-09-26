// Display-only helpers for Watchlist cards. They never change the stored brief: the full text is still available
// through the expandable detail on /watchlist and the full analysis page.

/** Collapse all whitespace (including the line breaks between paragraphs) into single spaces. */
export function normalizeSpace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** The brief's own paragraphs, in order, for rendering the full summary as plain text. */
export function briefParagraphs(text: string): string[] {
  return text.split(/\r?\n+/).map(p => p.trim()).filter(Boolean);
}

// A full stop after one of these does not end a sentence.
const ABBREVIATION = /(?:\bU\.S|\bU\.K|\bDr|\bMr|\bMrs|\bMs|\bSt|\bJr|\bSr|\bvs|\bNo|\bInc|\bCo|\bLtd|\be\.g|\bi\.e)$/i;

export type Excerpt = { excerpt: string; truncated: boolean };

/**
 * A limited excerpt of `text`: the whole text when it fits, otherwise the leading sentence(s) if they end within
 * [45%, 100%] of `max`, else the leading words, followed by an ellipsis. Unbroken strings are cut at `max`.
 */
export function watchExcerpt(text: string | null | undefined, max: number): Excerpt {
  const full = normalizeSpace(text ?? '');
  if (full.length <= max) return { excerpt: full, truncated: false };
  const window = full.slice(0, max);
  const floor = Math.floor(max * 0.45);
  let cut = -1;
  for (const m of window.matchAll(/[.!?](?=["'”’)]?\s)/g)) {
    const end = (m.index ?? 0) + 1;
    if (end >= floor && !ABBREVIATION.test(window.slice(0, end - 1))) cut = end; // keep the latest clean sentence end
  }
  if (cut > 0) return { excerpt: window.slice(0, cut).trim(), truncated: true };
  const space = window.lastIndexOf(' ');
  const base = space >= Math.floor(max * 0.6) ? window.slice(0, space) : window;
  return { excerpt: base.replace(/[\s,;:–—-]+$/, '') + '…', truncated: true };
}
