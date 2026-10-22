# Four-desk discovery and selection repair

Applies to all four regional desks on the next automatic run. No schedule change,
manual research, publication or send is required to activate the pipeline code.

## Discovery

Each desk uses three bounded live-search passes: security/policy;
economy/infrastructure; society/technology plus a final search for omissions.
Each pass has at most four search uses and eight candidate events. A final draft
call produces at most twelve stories. These are cost/output ceilings, not quotas.
This replaces one unrestricted discovery/drafting call with three discovery calls
and one drafting call per desk. Gemini/Claude editorial verification is unchanged.

Regional BBC RSS supplies headline/link/date leads only. Local publishers and
official agencies are a separate source checklist for live searches. A broken or
empty feed is recorded; it does not disable independent web discovery. Feed text
and search results are untrusted evidence, never operational instructions. No
Times of India/Economic Times commercial feed ingestion is added.

Source publication and actual new-development dates are separate structured
values. Timestamps require timezones. Date-only records retain their uncertainty;
two-day-old calendar dates are excluded because they cannot reliably establish a
48-hour window. Precise 24–48-hour developments require a still-current rationale.
Old incidents cannot become new candidates from a fresh live-blog update.

Actual search queries and result URLs are saved beside **model-reported** source
check statuses, not represented as proof that every publisher was accessed.
Every pass must contain an observed targeted source search and live search results.
Every candidate has an include/duplicate/background/out-of-scope/withhold/lower-
significance decision and reason. Final approved IDs and held counts are audited.
Private coverage ledgers use `coverage-v1/<edition>/<desk>`. Public story notes
retain a private `V2_DISCOVERY` provenance record through subsequent fact review.

Deduplication paginates the last 48h of edited entries instead of silently stopping
at 100 records. Completed desk receipts suppress repeat paid research for the
same desk/edition. An incomplete provider response cannot mark a desk complete.

## Selection and release

At release, one bounded Claude call assesses all final approved stories for
urgency, consequence and reach, with a specific rationale for each. Selection is
sorted by these dimensions, with an ID tie-break only. No save timestamp or desk
quota participates. Seven is the maximum, not a required minimum. The same saved
selection drives homepage, email and WhatsApp.

The ranking is persisted before any selection writes. A retry uses its existing
decision for the identical input. Changed input after a saved ranking requires
explicit reconciliation instead of an invisible paid re-selection. Unselected
flags left by interrupted writes are cleared before applying the saved ranking.
All approved stories remain available in the full regional signal feed.

The release workflow now receives the existing Anthropic secret for this single
selection call. Existing 09:00 release, 10:00 send, manual queue approval and single
build gates remain in place. No bypass of provider errors or duplicate-send
protection is introduced.

## Next automatic-cycle acceptance checks

- Four desks show three observed discovery passes and dated candidate decisions.
- Source/feed access limitations are visible in private audit records.
- Urgent events are included or have a specific exclusion/hold reason.
- Final approved signals retain discovery provenance after verification.
- Editorial selection explains all candidate scores; major events cannot lose
  to a routine item solely because it was inserted earlier.
- One release verifies production; one daily edition verifies email and channel.

These checks establish an inspectable process, not a guarantee that automated
discovery finds every news event. Offline tests cannot establish next-run coverage
quality, source availability, provider balance or delivery success.
