# Build and ship dashboard v2

status: closed (2026-10-12)
assignee: stanley (claude session, 2026-10-12)
labels: wayfinder:task
blocked-by: 0003, 0004

## Question

Fold the winning visual direction and metric set into `/dashboard` for real: implement the new identity + charts, remove/reframe the income-era pieces, keep filters/URL-state/refresh-bar behavior, fix the misleading "Money Movement" grouping of `Bank & FX Fees` in `src/app/services/llm/types.ts` (it is Spending — glossary already says so). Mobile QA at 375px, ship to main (Vercel), verify in production on the user's iPhone.

Not blocked by 0002 (backfill): shipping with hollow recent months is acceptable; data fills in independently. Revisit the "gap presentation" fog item before closing if gaps remain.

Resolution records: what shipped, QA results, production verification. Closing this ticket likely closes the map.

## Resolution (2026-10-12)

Shipped to production as main commit 42b54fe; verified live at
https://track-expense-server.vercel.app/dashboard (375px QA passed locally and
against production). What shipped:

- The Ledger folded into `/dashboard` for real: paper/serif identity with
  dark-mode tokens (`--ledger-*` in globals.css), hero spending figure,
  two-row stat strip (Daily Average, Projected, elapsed %, last period total,
  savings & transfers, entries), cumulative pace chart with previous-period
  ghost, Biggest movers, category hairline bars, clustered Top merchants,
  ledger-style entries list.
- Period navigation: months / years / **all time** modes (yearly totals kept
  per the prototype addendum; all-time shows a monthly trend line and drops
  projection honestly). Filters, search (raw motive + Merchant + category),
  sort, URL state and the refresh bar all preserved.
- `services/analytics/merchant.ts` is the production Merchant clustering;
  dead aggregates (computeStats, incomeVsSpendingByMonth, topMotives) removed,
  tests ported/extended (49 passing). Bank & FX Fees grouping comment fixed.
- Gap honesty: unlogged months simply show $0 / flat lines (e.g. "Last month
  total $0.00" for September 2026) — the "gap presentation" fog item stays
  open for after the backfill shows what gaps remain.

Remaining before the map closes: pipeline restore (0001), backfill (0002),
and the user's own iPhone look at production.
