import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { watchExcerpt, briefParagraphs, normalizeSpace } from '../src/lib/watchExcerpt.ts';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const css = read('src/app/globals.css');
const card = read('src/components/WatchCard.tsx');
const home = read('src/app/page.tsx');
const listing = read('src/app/watchlist/page.tsx');
const ELLIPSIS = String.fromCharCode(0x2026);

// A realistic brief: multi-paragraph, well over 1,400 characters, like the approved Signal Briefs.
const sentence = 'U.S. equities rallied on September 21, 2026, with the S&P 500 gaining 1 percent to pull within 0.9 percent of its all-time high, while the Nasdaq Composite climbed 1.6 percent.';
const long = Array.from({ length: 4 }, (_, i) => `${sentence} Paragraph ${i + 1} continues with more detail about yields, oil and the Federal Reserve decision on rates.`).join('\n\n');

test('excerpt: short text is returned whole and not marked truncated', () => {
  assert.deepEqual(watchExcerpt('A single short sentence.', 220), { excerpt: 'A single short sentence.', truncated: false });
  assert.deepEqual(watchExcerpt('', 220), { excerpt: '', truncated: false });
  assert.deepEqual(watchExcerpt(null, 220), { excerpt: '', truncated: false });
  assert.deepEqual(watchExcerpt(undefined, 220), { excerpt: '', truncated: false });
  assert.deepEqual(watchExcerpt('  spaced \n\n out  ', 50), { excerpt: 'spaced out', truncated: false });
});

test('excerpt: long briefs are limited, cut at a sentence when one fits, else at a word, with an ellipsis', () => {
  for (const max of [220, 280]) {
    const e = watchExcerpt(long, max);
    assert.ok(e.truncated);
    assert.ok(e.excerpt.length <= max + 1, `${max}: ${e.excerpt.length}`);
    assert.ok(!/\n/.test(e.excerpt));
    assert.ok(/[.!?]$/.test(e.excerpt) || e.excerpt.endsWith(ELLIPSIS), e.excerpt.slice(-20));
    assert.ok(normalizeSpace(long).startsWith(e.excerpt.replace(ELLIPSIS, '')), 'excerpt is a true prefix of the brief; nothing is rewritten');
  }
  const twoSentences = 'First sentence is here. Second sentence is also here and quite a bit longer than the first one is. Third goes on and on without stopping for a very long time indeed.';
  assert.equal(watchExcerpt(twoSentences, 100).excerpt, 'First sentence is here. Second sentence is also here and quite a bit longer than the first one is.');
  const w = watchExcerpt('word '.repeat(80), 100);
  assert.ok(w.excerpt.endsWith('word' + ELLIPSIS), w.excerpt.slice(-12));
  assert.ok(w.excerpt.length <= 101);
});

test('excerpt: abbreviations such as U.S. do not end a sentence; unbroken strings are hard-cut', () => {
  const t = 'The U.S. Senate voted on the proposal while officials from the U.S. Treasury watched closely and analysts in Dubai and London debated the effect on yields for weeks.';
  const e = watchExcerpt(t, 60);
  assert.ok(!/U\.S\.$/.test(e.excerpt), e.excerpt);
  const y = watchExcerpt('Y'.repeat(2000), 280);
  assert.equal(y.excerpt, 'Y'.repeat(280) + ELLIPSIS);
  assert.ok(y.truncated);
});

test('full text is preserved: paragraphs rejoin to the original brief', () => {
  const paras = briefParagraphs(long);
  assert.equal(paras.length, 4);
  assert.equal(normalizeSpace(paras.join(' ')), normalizeSpace(long));
  assert.deepEqual(briefParagraphs(''), []);
  assert.deepEqual(briefParagraphs('one\r\n\r\ntwo\n\n\nthree'), ['one', 'two', 'three']);
});

test('cards: excerpts only, links only to the existing /signals/<id> page, never an invented URL', () => {
  assert.match(card, /const href = `\/signals\/\$\{story\.id\}`/);
  assert.equal((card.match(/href=/g) ?? []).length, 2, 'title link and Read full analysis link only');
  assert.doesNotMatch(card, /https?:\/\//, 'no external or invented URLs');
  assert.doesNotMatch(card, /dangerouslySetInnerHTML/);
  assert.match(card, /Read full analysis/);
  assert.match(card, /variant === 'page' && truncated/, 'full summary is offered inline on /watchlist when the excerpt is limited');
  assert.match(card, /<details className="watch-details"><summary>Show full summary<\/summary>/);
  assert.match(card, /\{excerpt \? <p className="watch-excerpt">/, 'a missing summary renders no empty paragraph');
  assert.match(card, /story\.watchStatus \|\| 'Status pending'/);
});

test('both pages use the shared card; selection criteria and status handling are unchanged', () => {
  assert.match(home, /const watch = stories\.filter\(s => s\.watchlist && s\.watchStatus === 'Active'\)\.slice\(0, 4\);/);
  assert.match(home, /<WatchCard key=\{s\.id\} story=\{s\} variant="aside" \/>/);
  assert.match(home, /No approved active Watchlist entries are available\./);
  assert.match(home, /<Link className="watch-all" href="\/watchlist">View Watchlist/);
  assert.match(listing, /<WatchCard key=\{s\.id\} story=\{s\} variant="page" \/>/);
  assert.match(listing, /\(await getStories\(\)\)\.filter\(s => s\.watchlist\)/);
  for (const status of ['Active', 'Resolved', 'Abandoned']) assert.match(listing, new RegExp(`s\\.watchStatus === '${status}'`));
  assert.match(listing, /Status pending editorial review/);
  assert.match(listing, /No approved active Watchlist entries\./);
  const notion = read('src/lib/notion.ts');
  assert.doesNotMatch(notion, /method:\s*'(PATCH|PUT|DELETE)'/);
  assert.equal((notion.match(/method:'POST'/g) ?? []).length, 1, 'still only the read-only query POST');
});

test('layout: parent grid, sidebar width, wrapping, breakpoints and no fixed heights that clip', () => {
  assert.match(css, /\.content\{grid-template-columns:minmax\(0,2fr\) minmax\(280px,1fr\);gap:48px\}/);
  assert.match(css, /\.content>\*\{min-width:0\}/);
  assert.match(css, /aside\{min-width:0;box-sizing:border-box;padding-left:28px\}/);
  assert.match(css, /@media\(max-width:900px\)\{\.content\{grid-template-columns:1fr;gap:40px;padding:48px 0\}aside\{border-left:0;border-top:1px solid #d9d5cb/);
  assert.match(css, /\.watch-list\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(min\(100%,260px\),1fr\)\)/);
  assert.match(css, /\.watch-grid\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,320px\),1fr\)\);gap:18px;align-items:start/);
  assert.match(css, /\.watch-card\{[^}]*box-sizing:border-box[^}]*overflow-wrap:anywhere/);
  const rules = css.split('\n').filter(l => l.startsWith('.watch')).join('\n');
  assert.doesNotMatch(rules, /(^|[;{])\s*(height|max-height)\s*:/m, 'no fixed heights on Watchlist rules');
  assert.doesNotMatch(rules, /line-clamp|text-overflow/, 'titles and excerpts are never visually clipped');
  assert.match(rules, /min-width:0/);
});

// ---- contrast ----
function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('Watchlist text meets contrast on white cards and the paper background', () => {
  const on = ['#ffffff', '#faf8f4'];
  const pairs: [string, RegExp, number][] = [
    ['status gold', /\.watch-card \.status\{[^}]*color:(#[0-9a-f]{6})/, 7],
    ['review date', /\.watch-review\{[^}]*color:(#[0-9a-f]{6})/, 7],
    ['excerpt', /\.watch-card \.watch-excerpt\{[^}]*color:(#[0-9a-f]{6})/, 7],
    ['summary toggle', /\.watch-details summary\{[^}]*color:(#[0-9a-f]{6})/, 7],
    ['eyebrow', /\.watch-page \.eyebrow\{color:(#[0-9a-f]{6})/, 7],
  ];
  for (const [name, re, min] of pairs) {
    const hex = re.exec(css)?.[1];
    assert.ok(hex, name);
    for (const bg of on) assert.ok(ratio(hex!, bg) >= min, `${name} ${hex} on ${bg}: ${ratio(hex!, bg).toFixed(2)}`);
  }
  assert.ok(ratio('#173b60', '#ffffff') >= 7, 'navy titles on white cards');
  assert.match(css, /\.watch-card h3\{[^}]*color:var\(--navy\)/);
  const badge = /\.watch-count\{[^}]*background:(#[0-9a-f]{6});color:(#[0-9a-f]{6})/.exec(css);
  assert.ok(badge && ratio(badge[2], badge[1]) >= 4.5, 'count badge');
});
