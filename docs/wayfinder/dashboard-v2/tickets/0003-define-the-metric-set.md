# Define the metric set for a spending-focused dashboard

status: open
assignee:
labels: wayfinder:grilling
blocked-by: —

## Question

With income untracked by decision, Income / Net / income-vs-spending can't stay as they are. Decide what the dashboard reports instead:

- What replaces the Income and Net tiles (candidates: daily-average spend, spending pace "on track for $X this month", biggest category mover vs last month, Money Movement)?
- Does the income-vs-spending chart go entirely, or become something else (e.g. month-over-month spending comparison)?
- Which new insight modules make the cut: recurring-charge/subscription view, biggest movers, merchant-level grouping, weekday/weekend split…?
- Put the deferred call to the user: merchant-name clustering at **display** time for "Top spending" (read-only canonical mapping in code, sheet untouched) — wanted or not?

Resolves by grilling + domain-modeling with the user. The answer is the metric list the prototype (0004) then renders; update GLOSSARY.md if new terms crystallise (e.g. "pace", "recurring").
