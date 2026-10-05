# Free first-pass verification and manual review

Desk publication uses one Groq `openai/gpt-oss-120b` review per valid draft, with excerpts fetched from up to three cited public HTTPS sources. There are no verification retries, automated factual repairs, model tools or paid-provider fallbacks. Do not use a paid Groq account: code cannot determine the billing tier from an API key.

Add `GROQ_API_KEY` to repository Actions secrets using a Groq Free-plan account. Until configured, stories are saved to the private queue with the missing-key reason. HTTP 429, provider outages, unsupported evidence or unresolved findings likewise queue the draft. A successfully saved hold is a successful desk run. Storage or generation failures can still fail.

Generation and brief fitting remain Anthropic calls and retain their existing costs. Existing Gemini review-only tools are separate and unchanged; scheduled desk verification no longer calls Gemini.

The password-protected `/unverified-signals` list links to each draft. The detail view exposes its brief, public sources, failure findings and a suggested resolution. Editors can change the headline, brief and sources, save privately, approve after explicitly confirming manual verification and entering a resolution, or move a draft to Notion trash. Full retained originals remain available through the Notion link. No automatic review pass is claimed for manual approval.

Publication changes `Ready to Post` to true. The normal half-hour content checker handles the production refresh; approval does not immediately trigger a deploy or select the homepage. Private saves and deletion do not publish. The recorded findings and manual resolution remain private in Internal Note.

Edits require the password session, trusted request origin, queue marker, Signal Feed data-source membership, unchecked publication flag and matching last-edited timestamp. A concurrent change detected before write is rejected. Notion does not offer atomic conditional updates; avoid editing the same draft simultaneously in Notion and the review page.
