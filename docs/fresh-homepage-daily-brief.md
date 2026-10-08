# Homepage and Daily Brief

The homepage lists up to seven newest approved Signals created less than 24 hours ago. Approval is required; the nightly Today's Intelligence checkbox and Homepage Date are not homepage gates. Creation time is conservative: editing an old record does not reset freshness. Timestamps are visible in Dubai time. Empty results are not filled with an old edition. Browser timers and visibility changes remove expired cards. Freshness applies to the homepage Watchlist and editorial panels too; historical content remains on its dedicated pages.

Public content refresh runs after approved writes/manual approvals, with the existing half-hour reconciliation as recovery. Static builds read the latest approved Notion content.

The 21:30 Dubai nightly selector now serves the Daily Brief. Existing Homepage Priority, Homepage Date and Today's Intelligence properties store that selection for compatibility. The isolated 22:00 sender sends the same selected set (up to seven) by Kit email and Whapi channel. A missing selection withholds delivery; there is no automatic fallback to the entire feed. Existing duplicate-send, legacy-cutover and channel-admin verification gates remain.

A recent creation time is not proof a reported event is recent or uniquely insightful. Live-source editorial verification and significance judgement remain pipeline responsibilities. This change fixes stale presentation and nightly gating, not reporting latency or every article's factual accuracy.
