# Aggregation layer

status: open
assignee:
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
