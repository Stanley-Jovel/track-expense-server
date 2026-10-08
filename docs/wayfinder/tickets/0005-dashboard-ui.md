# Dashboard UI

status: open
assignee: claude (this session)
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

## Progress

Built and committed on `dashboard` ("Build mobile-first expense dashboard at /dashboard"); awaiting the user's reaction before closing (HITL).

- Layout (mobile-first, single column; tiles 2×2 → 4-across on desktop): month nav (arrows + picker, defaults to latest month with data, "All time" option) → type/category selects → stat tiles (Spending with direction-aware delta, Income, Net, "To savings & transfers") → spending trend (area, daily per month / monthly all-time) → category bars (single-hue CSS bars, value-labeled) → income-vs-spending grouped bars (legend, aqua/blue) → top spending list → searchable/sortable transaction list with "Show more" paging.
- `/` redirects to `/dashboard`; starter page, smoke chart, and `page.module.css` removed.
- Fixed en route: the starter CSS reset (`* { padding:0; margin:0 }`, Arial body) was un-layered and overrode every Tailwind utility — removed; base-ui `SelectValue` shows raw values, so all triggers render explicit labels; chart colors ride CSS vars (`--viz-*`) defined in globals.
- Verified in dev at 375×812 and desktop width with live data: July 2026 (sparse), June 2026 (delta up = red), All time, filters, tooltips. Lint and 27 tests clean.
