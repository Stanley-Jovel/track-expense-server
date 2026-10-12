# Define the metric set for a spending-focused dashboard

status: closed (2026-10-12)
assignee: stanley (claude session, 2026-10-10)
labels: wayfinder:grilling
blocked-by: —

## Question

With income untracked by decision, Income / Net / income-vs-spending can't stay as they are. Decide what the dashboard reports instead:

- What replaces the Income and Net tiles (candidates: daily-average spend, spending pace "on track for $X this month", biggest category mover vs last month, Money Movement)?
- Does the income-vs-spending chart go entirely, or become something else (e.g. month-over-month spending comparison)?
- Which new insight modules make the cut: recurring-charge/subscription view, biggest movers, merchant-level grouping, weekday/weekend split…?
- Put the deferred call to the user: merchant-name clustering at **display** time for "Top spending" (read-only canonical mapping in code, sheet untouched) — wanted or not?

Resolves by grilling + domain-modeling with the user. The answer is the metric list the prototype (0004) then renders; update GLOSSARY.md if new terms crystallise (e.g. "pace", "recurring").

## Resolution (2026-10-12)

Grilled with the user; all four recommendations accepted as-is:

1. **Tiles**: Spending (with vs-previous delta), **Daily Average**, **Projected Spend** (pace; equals actual for past periods), To savings & transfers. Income and Net tiles are removed.
2. **Income-vs-spending chart is replaced by a cumulative pace chart**: the selected month's running Spending total as a line, with the previous month's cumulative line ghosted behind it.
3. **Insight modules**: **Biggest movers** (top categories by signed change vs previous period) is in. Recurring-charges detection is deferred to fog — the audit shows almost no recurring charges logged, so it would render empty; revisit after the 2026 backfill. Weekday/weekend split and average-transaction-size rejected.
4. **Display-time merchant clustering: yes.** Canonical Merchant names (strip SQ*/TST*/store numbers/location suffixes, merge known variants) used everywhere on the dashboard; search matches both raw Motive and Merchant. The sheet's Motive values are never altered.

New glossary terms recorded: **Merchant**, **Daily Average**, **Projected Spend** (GLOSSARY.md).
