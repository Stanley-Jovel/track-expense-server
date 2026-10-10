# Build and ship dashboard v2

status: open
assignee:
labels: wayfinder:task
blocked-by: 0003, 0004

## Question

Fold the winning visual direction and metric set into `/dashboard` for real: implement the new identity + charts, remove/reframe the income-era pieces, keep filters/URL-state/refresh-bar behavior, fix the misleading "Money Movement" grouping of `Bank & FX Fees` in `src/app/services/llm/types.ts` (it is Spending — glossary already says so). Mobile QA at 375px, ship to main (Vercel), verify in production on the user's iPhone.

Not blocked by 0002 (backfill): shipping with hollow recent months is acceptable; data fills in independently. Revisit the "gap presentation" fog item before closing if gaps remain.

Resolution records: what shipped, QA results, production verification. Closing this ticket likely closes the map.
