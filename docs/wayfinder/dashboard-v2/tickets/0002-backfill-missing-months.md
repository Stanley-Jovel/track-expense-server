# Backfill the missing 2026 months

status: open
assignee:
labels: wayfinder:task (HITL)
blocked-by: 0001

## Question

Append the unlogged transactions (primarily 2026-07-12 → 2026-10-09, and the 2026-04/05 gap if recoverable) to the Transactions sheet. The user exports the missing transactions from their bank/wallet; the agent parses the export and appends rows through the existing pipeline (or directly, matching the A:E shape), then verifies counts and date coverage on the dashboard.

Blocked by pipeline restore so the backfill window has a clean end point and resumed automation doesn't double-log the same days. Appending is allowed; editing existing rows is not (see map Notes).

Resolution records: rows appended per month, source of the export, and any residual gaps left unfilled (those feed the "gap presentation" fog item).
