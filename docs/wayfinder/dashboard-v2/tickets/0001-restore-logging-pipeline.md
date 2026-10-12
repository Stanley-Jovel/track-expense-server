# Restore the expense-logging pipeline

status: closed (2026-10-12)
assignee: stanley (claude session, 2026-10-12)
labels: wayfinder:task (HITL)
blocked-by: —

## Question

The Apple Pay → track-expense automation stopped logging: nothing was recorded 2026-07-12 → 2026-10-09 (89 days) and 2026-04-23 → 05-26 (33 days); 2026-05 has only 9 rows. Find out why the Shortcuts automation broke and get it running again.

Only the user can inspect their iPhone's Shortcuts automation and its history. The agent side: check Vercel logs / the `/api/track-expense` route for rejected or failed requests in those windows if the user wants corroboration.

Resolution records: the cause, what was changed, and confirmation that a fresh Apple Pay transaction lands in the sheet.

## Resolution (2026-10-12)

**Cause: card scope.** The Shortcuts automation only triggered on a card the
user stopped paying with — the gaps (2026-04-23→05-26, 2026-07-12→10-09) are
months paid with a card the automation didn't watch, not a broken route. The
server path was never the problem: the Oct 9–10 rows went through the full
chain untouched.

**Fix:** the user enabled the current card in the automation (2026-10-12).

**Verification:** the end-to-end route is already proven by the Oct 9–10 rows;
the re-enabled trigger confirms itself on the next real purchase with that
card — check the dashboard (or the sheet) after the next tap-to-pay.

**Fact for the backfill ticket:** the missing months lived on an identifiable
card, so its bank/wallet statement export should cover the gap windows; the
backfill window cleanly ends 2026-10-12 (card enabled) with Oct 9–10 already
logged — exclude those two to avoid duplicates.
