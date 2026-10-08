# Private queue maintenance

Production Actions run from main; Netlify site code runs from release/v2-english.

- New held drafts receive one immediate Claude source-backed recovery attempt.
- A remaining private draft is eligible for delayed review after one hour. The half-hour static content checker reviews up to three eligible drafts per run.
- At most two delayed attempts are allowed for unchanged title, brief, sources and desk. The attempt is recorded before calling Claude, including on provider failure. Changing that content resets the budget.
- Claude's explicit, evidenced final discard verdict removes the private draft through Notion Trash. Technical errors are holds. A published update target is never deleted by private queue maintenance.
- Approved recovery writes the corrected title, brief and direct sources to the same queue page, sets Ready to Post, then requests and verifies public publication. A concurrent manual edit or approval cancels the automatic write.
- Existing approved content is refreshed before queue reviews so manual approval does not wait on other drafts.
- New private drafts send a headline, desk, reason and protected review link to the account identified by Whapi's health endpoint. The recipient is not inferred from the newsletter/channel ID. The password is never included.
- Alert sends are claimed in the private note before transmission. A pending claim after a network ambiguity is not automatically resent. Inspect Whapi history before clearing it. Periodic workers wait five minutes before claiming an unsent alert, allowing the creator's immediate alert to finish.
- Retry state and alert status stay in Internal Note. Ready to Post removes the item from the private queue even when the original queue marker remains in the note.

The manually dispatched V2 queue maintenance workflow defaults to dry run. Dry run queries the queue but does not call Claude, write Notion, request builds or send messages. Production activation verified the connected Whapi account and submitted one test alert (Whapi accepted it; delivery remained pending at verification); a separate read-only review exercised Claude against an existing published signal.

Do not include old legacy held records in this queue merely because Ready to Post is false. Automatic maintenance requires the V2_UNVERIFIED_SIGNAL marker. Historical corpus cleanup is separate work.
