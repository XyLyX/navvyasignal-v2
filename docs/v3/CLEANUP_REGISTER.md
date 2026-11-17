# V3 Cleanup Register — proposed, not yet executed
Date: 2026-10-27. No production deletion is authorized by this register alone.

## Verified context
- XyLyX/navvyasignal-v2 exists, release/v2-english exists, and .github/workflows is a directory (contents not enumerated by current GitHub connector).
- XyLyX/navvyasignal-automation is archived. Archived does not prove all external consumers are disconnected.
- Notion CMS database is Signal Feed: collection://35b11486-b145-80ac-891f-000bd4c62627.
- 2026-10-19 Notion operations note specifies four regional desks and 09:00/10:00 publication slots; 2026-10-23 note reports a separate 30-minute Ready-to-Post checker restored in PR #26, first run then pending.
- Notion Category schema still contains legacy thematic and new regional desk options. Coverage Theme also has overlapping option names.
- Current connected Netlify account does not expose the NavvyaSignal project. No Netlify action until connected.

## Cleanup candidates and gates
| Candidate | Intended disposition | Required proof before deletion |
| --- | --- | --- |
| Legacy seven thematic desk schedules | Retire | Enumerate workflow files and active GitHub schedules; confirm regional replacement |
| Gemini verifier calls | Retire | Identify call sites, ensure policy gate covers required checks |
| Duplicate Claude passes | Consolidate | Compare editorial outcomes and failure behavior |
| Legacy Notion Category options | Migrate then retire | Count references; map to four regional desks; preserve historical page semantics |
| Duplicate Coverage Theme options | Normalize | Audit live records and downstream filters |
| Repeated Netlify builds | Remove | Verify bridge event and no-change behavior |
| Archived automation repo | Keep archived pending audit | Prove no secrets, webhooks, jobs or external references depend on it |
| Historical published pages | Keep | Preserve URLs and provenance |
| Rejected/deleted stories | Remove active payload; keep minimal exclusion fingerprint | Confirm no legal retention or audit requirement; prevent rediscovery |
| Old branches and scripts | Delete after audit | Compare with production and all active references |

## Non-negotiable safeguards
No blind bulk deletion. Export/backup Notion records and map references before any schema cleanup. Never delete published history. Never disable existing publication bridge before replacement passes parity tests. Keep an append-only deletion manifest (identifier, reason, timestamp, actor, exclusion fingerprint) without original sensitive payload. GitHub deletion only via reviewed PR, no direct production commit. Separate credentials revocation from code cleanup and coordinate with Netlify owner.

## Outstanding audit
Enumerate .github/workflows and active GitHub Actions; inspect release branch tree, all cron expressions and call sites; inspect PR #26 and production SHA; audit Notion records/status distribution and mapping; identify Netlify owner, deploy hooks and build schedules; inspect failure logs and actual costs. Only then populate file-specific removal list.
