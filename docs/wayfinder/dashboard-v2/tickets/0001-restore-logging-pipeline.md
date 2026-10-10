# Restore the expense-logging pipeline

status: open
assignee:
labels: wayfinder:task (HITL)
blocked-by: —

## Question

The Apple Pay → track-expense automation stopped logging: nothing was recorded 2026-07-12 → 2026-10-09 (89 days) and 2026-04-23 → 05-26 (33 days); 2026-05 has only 9 rows. Find out why the Shortcuts automation broke and get it running again.

Only the user can inspect their iPhone's Shortcuts automation and its history. The agent side: check Vercel logs / the `/api/track-expense` route for rejected or failed requests in those windows if the user wants corroboration.

Resolution records: the cause, what was changed, and confirmation that a fresh Apple Pay transaction lands in the sheet.
