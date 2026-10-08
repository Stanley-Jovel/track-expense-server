# Aggregation layer

status: closed
assignee: claude (this session)
labels: wayfinder:task
blocked-by: [Transaction read path with caching](0003-transaction-read-path.md)

## Question

(Execution ticket.) Pure, tested functions that turn `Transaction[]` + a filter (month or all-time, type, category) into everything the UI needs:

- Stat tiles: total Spending, total Income, net, and deltas vs previous month. **Spending per GLOSSARY.md**: Expense minus `Transfers` minus `Investments & Savings`.
- Spending-over-time series (daily within a month; monthly for all-time).
- Expenses-only category breakdown (Spending categories; Money Movement shown as its own separate figure, not a slice).
- Monthly income-vs-expense series.
- Top motives by total amount, with transaction count per motive.
- Filtered transaction list for the table.

No React, no I/O — plain functions with Jest tests covering the Spending exclusions and month-boundary edges.

## Resolution

Done on branch `dashboard`, commit "Add pure aggregation layer for the dashboard".

- Module: `src/app/services/analytics/aggregate.ts` — pure functions, no React, no I/O. 14 Jest tests in `__tests__/app/services/analytics/` cover the Spending exclusions, UTC month boundaries, leap February, year-crossing previous-month, and gap-filled month ranges.
- `DashboardFilter = { month: 'YYYY-MM' | 'all', type, category }` drives `filterTransactions`, `computeStats` (spending/income/net/moneyMovement + previous-month figures when a month is selected), `spendingOverTime` (zero-filled daily series per month, monthly for all-time), `categoryBreakdown` (Spending only, sorted desc), `incomeVsSpendingByMonth`, `topMotives(limit=10)`, plus `allCategories`/`allMonthKeys` helpers for the filter UI.
- Semantics pinned here: **net = income − spending** (Money Movement affects neither side; shown via its own `moneyMovement` figure); the income-vs-spending chart always spans all months (it's the zoomed-out view — the month filter doesn't apply, the category filter applies to the spending side only); top motives are Spending-only.
- All date bucketing uses UTC accessors, matching the UTC wall-clock parse of sheet serials.
