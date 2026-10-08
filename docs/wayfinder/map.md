# Map: Expense Dashboard

labels: `wayfinder:map`
tickets: [tickets/](tickets/)

## Destination

A mobile-first dashboard **shipped** at `/dashboard` in this app (with `/` redirecting to it): stat tiles (spending, income, net, vs previous month), spending-over-time trend, expenses-only category breakdown, monthly income-vs-expense chart, sortable/searchable transactions table, top motives by total amount, all driven by filters (month navigation defaulting to current month + all-time, type, category). Reads the full Transactions sheet server-side with light caching. No auth. Deployed and verified on the user's phone.

## Notes

- **Execution override**: this map carries execution — tickets build and ship the dashboard, not just decide it. (Chosen at charting.)
- Tracker: local markdown. Tickets live in `docs/wayfinder/tickets/`, one file each, with `status`, `assignee`, `labels`, and `blocked-by` fields in a header block. Claim = set `assignee`. Frontier = open, unassigned, all blockers closed.
- Consult [GLOSSARY.md](../../GLOSSARY.md) — especially **Spending** (excludes Transfers and Investments & Savings) before writing any aggregation.
- UI stack decided: Tailwind + shadcn/ui + Recharts. Mobile-first is a hard requirement — the user checks this on their iPhone.
- Data facts: sheet columns A:E = timestamp (`MM/DD/YYYY, HH:mm:ss` locale string written with USER_ENTERED), motive, amount, type, category. Sheet is populated mostly by Apple Pay automations; income rows are manual. Single currency, `$` USD.
- Light caching only (e.g. `revalidate` ~60s); no database, ever, for this effort.
- Category breakdown chart is **expenses only** (Spending); income appears only in tiles and the income-vs-expense chart. Top motives rank by total amount with count as secondary detail.
- Deploy target: Vercel (ship = push to main; verify after deploy).

## Decisions so far

<!-- one line per closed ticket: [title](tickets/NNNN-file.md): gist -->

- [Inspect live sheet data shape](tickets/0001-inspect-live-sheet-data-shape.md): 662 clean data rows + header; read with UNFORMATTED_VALUE (date serials + plain number amounts, parse serial as days since 1899-12-30 UTC) — FORMATTED date strings are inconsistent; no Categories sheet exists, derive the 24 categories from column E.

## Not yet specified

- Exact visual layout/composition of the mobile dashboard (card order, chart sizes) — will sharpen inside the Dashboard UI ticket against real data; no separate design ticket unless the first pass misses.

## Out of scope

- Authentication / access protection — user ruled the data harmless and read-only; public is fine.
- Per-category budgets, data export, editing transactions from the dashboard — not requested; dashboard is read-only.
- Any database or sync layer — Sheets is the store.
