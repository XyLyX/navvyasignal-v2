# NavvyaSignal research publishing protocol

Approved approach: 28 November 2026.

All research editions must use version-controlled canonical editorial content for website pages and downloadable PDFs. Generate PDFs deterministically during the build; do not maintain separate manually edited report copy. Include edition ID, revision, source register, methodology, claim status, chart units, and editorial status. Embed fonts with appropriate Unicode coverage. Validate PDF generation, text extraction, pagination, links and accessibility before release. Draft PDFs must remain in protected previews, visibly marked HOLD; no public distribution or indexing until independent verification and Ready to Post approval. Build failure must block release rather than silently omit the PDF. Publish website and PDF together, verify live links and record commit and release revision. Social distribution follows verified live canonical URLs. Bundle releases; avoid small production deployments.

First implementation: NS-REI-001, PR #63. Existing manually generated PDF is a reference draft, not the canonical build artifact.
