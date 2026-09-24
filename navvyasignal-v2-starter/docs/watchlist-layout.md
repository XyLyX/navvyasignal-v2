# Watchlist layout (V2.8.4)

Display-only refinement. Selection criteria, statuses, review dates and the Notion adapter (`src/lib/notion.ts`, read-only) are unchanged.

## What was wrong (measured on the 24 Sep 2026 Deploy Preview, 69 entries: 32 Active, 37 Resolved)

- Each entry's **Signal Brief** is 1,382-2,045 characters over 2-4 paragraphs, and it was printed in full.
- **Homepage sidebar**: the brief filled a 298 px text column (34-49 lines per entry). Four cards were 999-1,371 px tall and made the sidebar 4,658 px, stretching the whole two-column row.
- **/watchlist**: every entry was one full-width block (about 10 lines at 1,045 px, 33,287 px page on desktop, 80,717 px at 375 px wide), and titles were not linked.
- The layout also lacked `min-width:0` on grid children and had no tablet breakpoint (the sidebar only stacked at 760 px).
- Right-edge misalignment was **not reproduced**: no horizontal overflow and the sidebar's right edge matched the container. Review dates were readable (dark text), so no colour bug there either.
- 35 of 69 briefs end mid-word at exactly 2,000 characters. That is a Notion rich-text limit in the source records, not something this change can or should edit.

## What changed

- `src/lib/watchExcerpt.ts` builds a **display-only excerpt**: the leading sentence(s) up to the limit (220 characters in the sidebar, 280 on /watchlist), else the leading words, with an ellipsis; unbroken strings are hard-cut. It never rewrites text: the excerpt is always a true prefix of the brief.
- `src/components/WatchCard.tsx` renders one entry for both pages: status, next review date, title (linked), excerpt, and **Read full analysis** to the existing `/signals/<id>` page that every approved record has. No URL is invented. On /watchlist, when the excerpt is limited, an expandable **Show full summary** shows the complete brief as plain-text paragraphs (no HTML injection). A missing summary simply omits the excerpt; a missing review date is omitted.
- Layout: the homepage parent grid is `minmax(0,2fr) minmax(280px,1fr)` with `min-width:0`, stacking full-width at 900 px; sidebar cards auto-fit (one column beside the editorial content, two on tablet, stacked on mobile). /watchlist uses an auto-fill grid (3 columns on desktop, 2 on tablet, 1 on mobile) with section counts. No fixed heights, no line-clamping, `overflow-wrap:anywhere` for unbroken strings.
- Colours: navy titles, `#33424f` body, `#6b4c10` gold labels (all at least 7:1 on white and the paper background).

## Measured result (same 69 entries, built locally against their real text)

| | Before | After |
| --- | --- | --- |
| Sidebar card height (desktop) | 999-1,371 px | 319-363 px |
| Sidebar height (desktop) | 4,658 px | 1,593 px |
| /watchlist page height, desktop | 33,287 px | 11,115 px (3 columns) |
| /watchlist page height, 375 px | 80,717 px | about 28,000 px |
| Horizontal overflow (all widths) | none | none |

## Testing note

`tests/watchlist.test.ts` covers the excerpt rules, full-text preservation, link safety, unchanged selection logic, layout rules and contrast. For the visual audit, entries were scraped read-only from the public Deploy Preview and fed to the unchanged adapter through a local fetch stub (not committed), including hostile cases: very long unbroken strings, an empty summary, a one-sentence summary and no review date.
