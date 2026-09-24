import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { nextTabIndex } from '../src/lib/tabNav.ts';

const root = path.join(import.meta.dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
const tabs = read('src/components/WatchTabs.tsx');
const card = read('src/components/WatchCard.tsx');
const page = read('src/app/watchlist/page.tsx');
const css = read('src/app/globals.css');

test('keyboard: arrows wrap, Home/End jump, other keys are ignored', () => {
  assert.equal(nextTabIndex('ArrowRight', 0, 2), 1);
  assert.equal(nextTabIndex('ArrowRight', 1, 2), 0, 'wraps forwards');
  assert.equal(nextTabIndex('ArrowLeft', 0, 2), 1, 'wraps backwards');
  assert.equal(nextTabIndex('ArrowLeft', 1, 2), 0);
  assert.equal(nextTabIndex('Home', 1, 2), 0);
  assert.equal(nextTabIndex('End', 0, 2), 1);
  for (const k of ['Tab', 'Enter', ' ', 'a', 'ArrowDown']) assert.equal(nextTabIndex(k, 0, 2), -1, k);
  assert.equal(nextTabIndex('ArrowRight', 0, 0), -1);
});

test('ARIA tabs pattern: tablist, tabs, panels, selection, roving tabindex and keyboard handler', () => {
  assert.match(tabs, /role="tablist" aria-label="Watchlist status"/);
  assert.match(tabs, /role="tab"/);
  assert.match(tabs, /aria-selected=\{on\}/);
  assert.match(tabs, /aria-controls=\{`watch-panel-\$\{t\.id\}`\}/);
  assert.match(tabs, /tabIndex=\{on \? 0 : -1\}/, 'roving tabindex');
  assert.match(tabs, /role="tabpanel" id=\{`watch-panel-\$\{t\.id\}`\} aria-labelledby=\{`watch-tab-\$\{t\.id\}`\} hidden=\{t\.id !== selected\} tabIndex=\{0\}/);
  assert.match(tabs, /onKeyDown=\{e => onKeyDown\(e, i\)\}/);
  assert.match(tabs, /nextTabIndex\(e\.key, index, tabs\.length\)/);
  assert.match(tabs, /e\.preventDefault\(\)/);
  assert.match(tabs, /type="button"/);
});

test('Active is selected by default and only the selected tab renders its records', () => {
  assert.match(tabs, /useState<WatchTab\['id'\]>\(tabs\[0\]\.id\)/);
  assert.match(page, /tabs=\{\[\s*\{ id: 'active', label: 'Active'[^}]*\},\s*\{ id: 'resolved', label: 'Resolved'/);
  assert.match(tabs, /\{t\.id === selected\s*\?/, 'unselected panels render no cards');
  assert.match(tabs, /window\.location\.hash/);
  assert.match(tabs, /addEventListener\('hashchange', apply\)/);
  assert.match(tabs, /removeEventListener\('hashchange', apply\)/);
});

test('counts are derived from the actual records, never hard-coded', () => {
  assert.match(tabs, /\{t\.entries\.length\}/);
  assert.match(tabs, /aria-label=\{`\$\{t\.entries\.length\} entries`\}/);
  assert.match(page, /const active = stories\.filter\(s => s\.watchStatus === 'Active'\)/);
  assert.match(page, /const resolved = stories\.filter\(s => s\.watchStatus === 'Resolved'\)/);
  assert.match(page, /entries: active\.map\(slim\)/);
  assert.match(page, /entries: resolved\.map\(slim\)/);
  assert.doesNotMatch(tabs, /\b(32|37|69)\b/);
  assert.match(page, /abandoned\.length > 0/, 'other statuses still appear when present');
  assert.match(page, /unspecified\.length > 0/);
});

test('summaries are collapsed initially and expand individually', () => {
  assert.match(card, /<details className="watch-details">/);
  assert.doesNotMatch(card, /<details[^>]*\bopen\b/, 'never open by default');
  assert.equal((card.match(/<details/g) ?? []).length, 1, 'one details element per card, so each opens on its own');
  assert.match(card, /<summary>Show full summary<\/summary>/);
  assert.doesNotMatch(tabs, /details|open=/, 'tabs never force summaries open');
});

test('genuine content is preserved: same card, links, status, review date', () => {
  assert.match(tabs, /<WatchCard key=\{s\.id\} story=\{s\} variant="page" \/>/);
  assert.match(card, /href=\{href\}/);
  assert.match(card, /story\.watchStatus \|\| 'Status pending'/);
  assert.match(card, /Next review/);
  assert.match(page, /slim = \(s: Story\): WatchEntry => \(\{ id: s\.id, title: s\.title, brief: s\.brief, watchStatus: s\.watchStatus, nextReview: s\.nextReview \}\)/);
});

// ---- colour, focus and non-colour indicators ----
function lum(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

test('Active underline is red, Resolved underline is blue, both meet 3:1 against the tab surface', () => {
  const red = /\.watch-tab-active\[aria-selected="true"\]\{border-bottom-color:(#[0-9a-f]{6})\}/.exec(css)?.[1];
  const blue = /\.watch-tab-resolved\[aria-selected="true"\]\{border-bottom-color:(#[0-9a-f]{6})\}/.exec(css)?.[1];
  assert.ok(red && blue);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(red!.slice(i, i + 2), 16));
  assert.ok(r > 150 && g < 70 && b < 70, `red: ${red}`);
  const [br, bg, bb] = [1, 3, 5].map(i => parseInt(blue!.slice(i, i + 2), 16));
  assert.ok(bb > 120 && br < 60 && bb > bg, `blue: ${blue}`);
  for (const c of [red!, blue!]) { assert.ok(ratio(c, '#ffffff') >= 4.5, c); assert.ok(ratio(c, '#faf8f4') >= 4.5, c); }
  assert.ok(ratio(red!, blue!) >= 1.2 || red !== blue, 'the two indicators differ');
});

test('selection is never colour-only: weight, thicker underline, aria-selected and a filled surface', () => {
  assert.match(css, /\.watch-tab\[aria-selected="true"\]\{font-weight:700;color:#1f2c38;background:#fff;border-bottom-width:6px\}/);
  assert.match(css, /\.watch-tab\{[^}]*border-bottom:4px solid transparent/, 'unselected tabs carry no coloured underline');
  assert.match(css, /\.watch-tab\[aria-selected="true"\] \.watch-count\{background:#1f2c38;color:#fff\}/);
  assert.ok(ratio('#1f2c38', '#ffffff') >= 7);
  assert.ok(ratio('#33424f', '#faf8f4') >= 7, 'unselected label');
  assert.match(tabs, /<span className="watch-tab-label">\{t\.label\}<\/span>/, 'each tab has a text label');
});

test('visible keyboard focus on tabs and panels', () => {
  assert.match(css, /\.watch-tab:focus-visible\{outline:3px solid #173b60/);
  assert.match(css, /\.watch-tabpanel:focus-visible\{outline:3px solid #173b60/);
  assert.ok(ratio('#173b60', '#ffffff') >= 7);
});

test('responsive 3/2/1 grid and no fixed heights are preserved inside the panel', () => {
  assert.match(css, /\.watch-grid\{display:grid;grid-template-columns:repeat\(auto-fill,minmax\(min\(100%,320px\),1fr\)\);gap:18px;align-items:start/);
  const rules = css.split('\n').filter(l => l.startsWith('.watch')).join('\n');
  assert.doesNotMatch(rules, /(^|[;{])\s*(height|max-height)\s*:/m);
  assert.match(css, /@media\(max-width:480px\)\{\.watch-tab\{padding:11px 14px 9px/, 'tabs fit a 375px screen');
});
