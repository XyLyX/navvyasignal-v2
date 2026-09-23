# V2.2 homepage editorial contract (preview)

The existing Notion Signal Feed has two new additive properties: `Homepage Date` (date) and `Homepage Priority` (number). Neither changes V1 Framer sync or the existing `Ready to Post` and `Today's Intelligence` checkboxes. The V2 application reads Notion only.

## Selecting a story

For a story to appear in **Today's Intelligence** on the V2 preview, an editor must set all three: `Ready to Post = checked`, `Today's Intelligence = checked`, and `Homepage Date = the publication date in Asia/Dubai (YYYY-MM-DD)`. Set `Homepage Priority` to a positive number, with 1 displayed first. Unset or invalid priorities follow numbered priorities; ties are resolved by newest creation date, then stable page ID. The homepage displays a maximum of seven stories across all desks, without a one-per-desk quota. Do not use the date field as a scheduled publication approval mechanism; the approval checkbox remains mandatory.

A story whose date is not today is excluded from the homepage even if its old checkbox remains checked. It remains in the approved archive and its desk. If no stories are selected for the current date, the homepage shows an explicit empty state; it does not silently resurrect yesterday's stories. No historical records have been backfilled or automatically selected.

## Static export limitation

The date is evaluated in Dubai time during the Netlify **build**, not on every request. Editing Notion, changing a selection, or crossing midnight does not update an already deployed static preview. A new preview deployment is required to reflect changes. Scheduled refresh and the midnight rollover must be designed and tested separately before production. Do not present this as 15-minute ISR.

## Validation checklist

- Build/typecheck passes on the development branch.
- Approved + checked + today's Dubai date appears; a date from yesterday or tomorrow does not.
- Unapproved stories never appear even when dated and checked.
- Seven-story limit, numeric priority, deterministic ties, and cross-desk selection work.
- No selected stories shows the empty state without affecting desk/archive records.
- Netlify preview renders; production Framer and existing Notion sync remain untouched.
