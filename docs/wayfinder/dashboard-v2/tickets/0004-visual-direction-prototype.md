# Visual direction prototype

status: closed (2026-10-12)
assignee: stanley (claude session, 2026-10-12)
labels: wayfinder:prototype
blocked-by: 0003

## Question

What should the new dashboard look like? Build a UI prototype (prototype skill, UI branch): radically different variants on one route switchable by URL param — each a distinct visual identity (palette, typography, density, dark-mode treatment) *and* chart vocabulary (e.g. donut/treemap categories, calendar heatmap, sparkline tiles, animated numbers) — rendered with the real metric set decided in 0003 and real sheet data. User reacts; a winner (or a blend) is the verdict.

Blocked by 0003 because variants must render the agreed metrics, not the outgoing Income/Net set.

Resolution records: the winning direction and the specific chart/visual choices to carry into the build; prototype captured on a throwaway branch per the prototype skill.

## Asset

Prototype on branch `prototype/dashboard-v2` (final commit e2a7f38): three variants on `/dashboard` via `?variant=A|B|C` (A Ledger, B Pulse, C Bento), dev-only floating switcher, simulated mid-month (latest dense month) labeled in the switcher.

## Resolution (2026-10-12)

**A — Ledger wins**: editorial/typographic direction (warm paper, serif numerals, hairline rules, dotted-leader movers, thin two-line pace chart), **augmented with Pulse's statistics** the user wanted carried over: month-elapsed %, last-month total (plus an entries count), shown as a second stat-strip row. B (Pulse, dark glassy) and C (Bento, heatmap grid) rejected as overall directions.

Carries into the build ticket: the Ledger identity with the two-row stat strip, pace chart, movers, category hairline bars, clustered Top merchants, recent-entries ledger. The blend was verified in the prototype (variant A, commit e2a7f38) on a 375px viewport.

### Addendum (user feedback after the verdict)

The Ledger must keep period navigation. Prototyped as serif ‹ › arrows in the header stepping month-by-month (commit c333722): past months render as complete months (hero drops "so far", elapsed 100%, projected = actual), per the metric-set ticket's graceful-degrade rule. Year and all-time views in the Ledger idiom remain for the build ticket, which already carries "keep filters/URL-state".
