# Strategic Outlook 2027–2030 — separate preview architecture

This branch is based on the Insights & Analysis PR #57 branch, but **does not merge or deploy either stream**.

- `/insights` remains the separate long-form Insights publication stream and its Notion approval gates are unchanged.
- `/signals` and the existing Signal Feed, scheduler, lease and build hooks are untouched.
- `/strategic-outlook` is a separate route namespace and dataset. It does not query Insights or Signals.
- No manuscript is embedded in this public GitHub branch: all eight articles remain on HOLD. The pages deliberately display only metadata and HOLD notices.
- Every route returns 404 unless `STRATEGIC_OUTLOOK_PRIVATE_PREVIEW=true` and `NEXT_PUBLIC_V2_PRODUCTION` is not `true`.
- Preview routes explicitly set robots noindex, nofollow, noarchive. This is not an authentication mechanism. Do not enable a public preview containing confidential text without access controls.
- The image paths in the section metadata are **reserved asset names**, not currently committed binaries. The original Economist cover must not be publicly published without rights clearance.
- 2027 is an immutable dated baseline; 2028 and 2029 annual reviews and the 2030 final assessment must be new records, not edits to the baseline.
- The private local editorial package contains the manuscript texts and high-resolution hero assets; they must pass editorial approval and rights review before a publishing adapter can ingest them.
- This PR is engineering staging only. Do not merge to main, connect live Notion, or deploy production without explicit authorisation.
