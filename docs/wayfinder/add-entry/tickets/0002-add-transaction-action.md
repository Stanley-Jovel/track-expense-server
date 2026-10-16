# 0002: addTransaction server action

status: open
assignee: —
labels: wayfinder:task
blocked-by: —

## What to build

The server side of Add Entry, as specified in the map's Implementation Decisions:

- The `appendTransaction` input gains an optional `date?: Date`, in both the Google Sheets service and the mock. When it is missing, now is used as before.
- The field checks in `modifyTransaction` (Motive, amount, day, closed Category list) move into one shared helper. `modifyTransaction` keeps its rule allowing the row's existing out-of-list Category.
- A new `addTransaction` server action in `src/app/dashboard/actions.ts`. It takes Type, Motive, amount, day and Category, and uses the shared helper. It also validates Type and rejects future days, stamps the row with the time of saving on the chosen day, never writes F, ignores Category Overrides, and calls `refreshDashboard()` after a write.

## Acceptance criteria

- [ ] `addTransaction` appends an Expense and an Income with the chosen day and Category, and F blank.
- [ ] A backdated day is kept, and the time of day is the time of saving.
- [ ] A future day, an unknown Category, an empty Motive, a non-positive amount and an invalid Type are each refused with nothing written.
- [ ] A Category Override for the Motive's Merchant doesn't change the chosen Category.
- [ ] The existing `modifyTransaction` and ingest route tests pass unchanged.
- [ ] New tests are in `__tests__/app/dashboard/`, modeled on `modify-transaction.test.ts`.
