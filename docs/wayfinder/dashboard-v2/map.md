# Map: Dashboard v2 — Visual Identity & Data Trust

labels: `wayfinder:map`
tickets: [tickets/](tickets/)
status: open

## Destination

A visually distinctive, **spending-focused** dashboard **shipped** at `/dashboard`: a real visual identity + richer visualizations (chosen by prototype), reporting numbers the user can trust — logging pipeline restored and the missing 2026 months backfilled, the income pretense removed (Income/Net/income-vs-spending go away or are reframed), metrics redefined around Spending. Deployed to production and verified on the user's iPhone.

## Notes

- **Execution override**: tickets build and ship, not just decide (carried from the first map).
- Tracker: local markdown. Tickets live in `docs/wayfinder/dashboard-v2/tickets/`, one file each, with `status`, `assignee`, `labels`, `blocked-by` header fields. Claim = set `assignee`. Frontier = open, unassigned, all blockers closed.
- Carried constraints: mobile-first is a hard requirement (user verifies on iPhone); no auth; no database ever; Sheets is the source of truth; light caching only. Consult [GLOSSARY.md](../../../GLOSSARY.md) before touching aggregation.
- **The sheet's existing rows are never edited by this effort** (user's call): the Jan-2025 backfill (105 rows dated 2025-01-02), ~5 probable duplicates, ~10 miscategorized rows, the $0 row, and the 2 misclassified Income rows all stay. Appending new rows (the 2026 backfill) is allowed.
- **No spike/anomaly heuristics, ever** — large single-day spending is legitimate and must never be flagged or smoothed.
- Data-audit facts (2026-10-10, full-sheet read): 664 rows, 2025-01-02 → 2026-10-10; unlogged gaps 2026-04-23→05-26 (33d) and 2026-07-12→10-09 (89d); income effectively untracked since Feb 2025; merchant names fragmented by card-feed noise (SQ*/TST* prefixes, store numbers) across ~15 merchants; `Utilities` never used; `Subscriptions` has 2 rows (recurring charges likely unlogged).
- Decided at charting: **Bank & FX Fees counts as Spending** (glossary already says so); the misleading "Money Movement" grouping of it in `src/app/services/llm/types.ts` gets fixed during the build ticket.

## Decisions so far

<!-- one line per closed ticket: [title](tickets/NNNN-file.md): gist -->

## Not yet specified

- How charts present residual unlogged periods (gaps as "no data" vs implied-zero) — sharpens after the backfill ticket shows what gaps remain.
- Which new insight modules make the final cut (daily pace, biggest movers vs last month, recurring-charge view, merchant-level grouping…) — sharpens inside the metric-set grilling and the visual prototype.
- Whether merchant-name clustering at *display* time is wanted for "Top spending" (read-only, no sheet changes) — the user declined data *fixes*; display grouping is a separate call to put to them in the metric-set ticket.

## Out of scope

- Editing existing sheet rows (dedupe, recategorize, redate the Jan backfill, fix the $0 row, reclassify the 2 Income rows) — user ruled the data fine as-is (charting, Q5/Q6).
- Spike/anomaly detection — spikes are legitimate (charting).
- Income tracking — user chose a spending-focused dashboard over starting to log income (charting, Q8).
- Auth, databases, editing transactions from the dashboard — carried from the first map.
