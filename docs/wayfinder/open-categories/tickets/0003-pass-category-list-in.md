# 0003: Pass the Category list in instead of importing it

status: closed (2026-10-14)
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: None (can start immediately)

## What to build

A refactor that changes no behavior and makes the next ticket a small change. Everything that uses the Category list, or knows which Categories count as Spending, receives it as input instead of importing the built-in list. For now, every caller still passes the built-in list and its Spending flags, so the user sees nothing different.

The consumers that change:

- the LLM parse, and the fallback service that passes the list to each provider
- the response schema and the prompt, both built from the list they are given
- the dashboard's Spending and Money Movement calculations, which receive the set of Categories that don't count as Spending
- the Modify sheet's Category options, and the validation in the Modify and Category correction actions
- the override validation in the spreadsheet service

The Category type becomes a string checked against the given list.

## Acceptance criteria

- [x] No module outside the built-in list's own definition reads that list directly. It is passed in from the edges (ingest, the dashboard page, server actions).
- [x] The hard-coded Money Movement set is gone. The aggregation functions take the non-Spending set as input and stay pure.
- [x] The schema's Category enum and the prompt's allowed list are built per call from the given list.
- [x] A Category outside the given list is still rejected everywhere it is rejected today.
- [x] Behavior is unchanged: the existing test suite passes without changing any expectations, and only call sites change.
- [x] Lint and type-check pass.
