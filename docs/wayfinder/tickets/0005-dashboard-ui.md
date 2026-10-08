# Dashboard UI

status: open
assignee:
labels: wayfinder:task
blocked-by: [Set up UI stack](0002-set-up-ui-stack.md), [Aggregation layer](0004-aggregation-layer.md)

## Question

(Execution ticket, HITL — show the result and iterate.) Build the `/dashboard` page, **mobile-first** (primary device: iPhone), desktop responsive second:

- Month navigation (default current month, arrows + all-time toggle) and filters for type and category, driving every section.
- Stat tiles (Spending, Income, Net, vs previous month), spending trend chart, expenses-only category breakdown, monthly income-vs-expense chart, top motives, and a sortable/searchable transactions table — shadcn/ui + Recharts, consulting the dataviz skill before writing chart code.
- `$` USD formatting throughout. Money Movement displayed separately per the glossary.
- Server component fetches via the read path; filters can be client-side over the full dataset (data volume is small).
- Redirect `/` → `/dashboard`.

Done when it renders real sheet data and looks right at 375px width.
