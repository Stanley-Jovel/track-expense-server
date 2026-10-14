# Map: Dashboard v2 — Visual Identity & Data Trust

labels: `wayfinder:map`
tickets: [tickets/](tickets/)
status: closed (2026-10-12) — destination reached

## Destination

A visually distinctive, **spending-focused** dashboard **shipped** at `/dashboard`: a real visual identity + richer visualizations (chosen by prototype), reporting numbers the user can trust — logging pipeline restored (backfill ruled out of scope 2026-10-12), the income pretense removed (Income/Net/income-vs-spending go away or are reframed), metrics redefined around Spending. Deployed to production and verified on the user's iPhone.

## Notes

- **Execution override**: tickets build and ship, not just decide (carried from the first map).
- Tracker: local markdown. Tickets live in `docs/wayfinder/dashboard-v2/tickets/`, one file each, with `status`, `assignee`, `labels`, `blocked-by` header fields. Claim = set `assignee`. Frontier = open, unassigned, all blockers closed.
- Carried constraints: mobile-first is a hard requirement (user verifies on iPhone); no auth; no database ever; Sheets is the source of truth; light caching only. Consult [GLOSSARY.md](../../../GLOSSARY.md) before touching aggregation.
- **The sheet's existing rows are never edited by this effort** (user's call): the Jan-2025 backfill (105 rows dated 2025-01-02), ~5 probable duplicates, ~10 miscategorized rows, the $0 row, and the 2 misclassified Income rows all stay. Appending new rows (the 2026 backfill) is allowed.
  - *Reversed for the Category column only (2026-10-12, user's call while grilling the [category-corrections](../category-corrections/map.md) map):* the app may now rewrite the Category cell of existing rows when the user corrects a Merchant's Category. Date, Motive, amount and Type stay append-only.
  - *Reversed for the amount column too (2026-10-14, user's call after a $1.50 purchase was logged as $0):* the dashboard can correct one entry's amount in place. Date, Motive and Type stay append-only.
- **No spike/anomaly heuristics, ever** — large single-day spending is legitimate and must never be flagged or smoothed.
- Data-audit facts (2026-10-10, full-sheet read): 664 rows, 2025-01-02 → 2026-10-10; unlogged gaps 2026-04-23→05-26 (33d) and 2026-07-12→10-09 (89d); income effectively untracked since Feb 2025; merchant names fragmented by card-feed noise (SQ*/TST* prefixes, store numbers) across ~15 merchants; `Utilities` never used; `Subscriptions` has 2 rows (recurring charges likely unlogged).
- Decided at charting: **Bank & FX Fees counts as Spending** (glossary already says so); the misleading "Money Movement" grouping of it in `src/app/services/llm/types.ts` gets fixed during the build ticket.

## Decisions so far

<!-- one line per closed ticket: [title](tickets/NNNN-file.md): gist -->

- [Restore the expense-logging pipeline](tickets/0001-restore-logging-pipeline.md): cause was card scope — the automation watched a card no longer in use; user enabled the current card (2026-10-12). Next real purchase verifies; backfill window ends 2026-10-12.
- [Build and ship dashboard v2](tickets/0005-build-and-ship.md): shipped as 42b54fe and verified in production — the Ledger live at /dashboard with months/years/all-time navigation, pace chart, movers, Merchant clustering; income-era UI removed.
- [Visual direction prototype](tickets/0004-visual-direction-prototype.md): A "Ledger" wins (editorial serif/paper), augmented with Pulse's stats (month elapsed %, last month total) as a second stat-strip row; prototype preserved on branch `prototype/dashboard-v2`.
- [Define the metric set](tickets/0003-define-the-metric-set.md): tiles = Spending / Daily Average / Projected Spend / To savings & transfers (Income & Net removed); cumulative pace chart replaces income-vs-spending; Biggest movers is the one new module; display-time Merchant clustering is in (sheet untouched). New glossary terms: Merchant, Daily Average, Projected Spend.

## Not yet specified

<!-- Map closed; the items below were never needed to reach the destination.
     They are seeds for a future effort, not open work. -->

- Recurring-charges module — deferred: almost no recurring charges are logged today, so it would render empty; revisit after the 2026 backfill lands.
- LLM categorization of processor-prefixed motives — a restaurant paid via a POS fintech ("N1co*las Brumas N1co") was filed as Shopping — General because the parser sees processor noise, not the merchant. Possibly teach the parse prompt the Processor*Merchant convention (see `services/analytics/merchant.ts`); existing rows stay untouched per charting.

## Out of scope

- [Backfill the missing 2026 months](tickets/0002-backfill-missing-months.md) — the user has no access to those transactions and accepts the holes (2026-10-12); the destination was redrawn to drop the backfill. Gaps stay presented as honest zeros.
- Special "no data" gap markers in charts — moot with the backfill ruled out; the user accepts the current honest-zero presentation.

- Editing existing sheet rows (dedupe, recategorize, redate the Jan backfill, fix the $0 row, reclassify the 2 Income rows) — user ruled the data fine as-is (charting, Q5/Q6).
- Spike/anomaly detection — spikes are legitimate (charting).
- Income tracking — user chose a spending-focused dashboard over starting to log income (charting, Q8).
- Auth, databases, editing transactions from the dashboard — carried from the first map.

---

**Map closed 2026-10-12 — destination reached.** The Ledger is live in production (reviewed by the user, N1co labeling fixed on report), the metric set is spending-focused and trustworthy, and the logging pipeline fires again (card scope fixed). The one route change: the 2026 backfill was ruled out of scope rather than walked.
