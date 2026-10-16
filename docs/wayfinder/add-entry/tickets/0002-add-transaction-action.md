# 0002: addTransaction server action

status: closed (2026-10-16)
assignee: stanley (claude session, 2026-10-16)
labels: wayfinder:task
blocked-by: —

## What to build

The server side of Add Entry, as specified in the map's Implementation Decisions:

- The `appendTransaction` input gains an optional `date?: Date`, in both the Google Sheets service and the mock. When it is missing, now is used as before.
- The field checks in `modifyTransaction` (Motive, amount, day, closed Category list) move into one shared helper. `modifyTransaction` keeps its rule allowing the row's existing out-of-list Category.
- The ingest route's Category steps (Override for the Merchant, then the LLM, then `checkSuggestion`) become shared code that both the route and `addTransaction` use. The route's behavior and tests don't change.
- A new `addTransaction` server action in `src/app/dashboard/actions.ts`. It takes Type, Motive, amount, day and an optional Category, and uses the shared helper. It also validates Type, rejects future days, stamps the row with the time of saving on the chosen day, and calls `refreshDashboard()` after a write.
  - With a picked Category, F stays blank and Overrides are ignored.
  - With a blank Category, the Category is chosen by the shared ingest steps. The LLM is given a line built from the entry (such as `Expense: Farmers market $8.75`) through `parseTransaction`, and only its Category and suggestion are used.
  - If no Category can be chosen, nothing is written and it returns "Couldn't guess a category. Pick one or try again."

## Acceptance criteria

- [x] `addTransaction` appends an Expense and an Income with the chosen day and Category, and F blank.
- [x] A backdated day is kept, and the time of day is the time of saving.
- [x] A future day, an unknown Category, an empty Motive, a non-positive amount and an invalid Type are each refused with nothing written.
- [x] A Category Override for the Motive's Merchant doesn't change a picked Category.
- [x] A blank Category is filed by the Merchant's Override with no LLM call.
- [x] A blank Category is otherwise filed by the (mocked) LLM, its suggestion goes through `checkSuggestion` into F, and the LLM's own amount, Type and Motive are ignored.
- [x] A blank Category with a failing LLM is refused with nothing written.
- [x] The existing `modifyTransaction` and ingest route tests pass unchanged.
- [x] New tests are in `__tests__/app/dashboard/`, modeled on `modify-transaction.test.ts`.

## Notes

- 2026-10-16: Built test-first. `addTransaction(entry: NewTransaction)` returns `{ ok: true } | { ok: false, error }`.
- The filing steps moved out of the ingest route into `src/app/services/categories/file-transactions.ts`: `readCategoryOverridesOrNone`, `overrideFor` and `fileTransactions`. The route's tests pass unchanged.
- `checkEntryFields` (Motive, amount, day format) and `onDay` (a day at a given time of day, rejecting impossible days) are shared by Modify and Add. The closed-list Category check stays inline in each action, because Modify's exception for the row's existing Category needs the row read first.
- `appendTransaction(data, at?)` takes one timestamp for the batch. The Google service writes a given one as its UTC wall-clock, wherever the server runs, so a local dev server doesn't shift it. Ingest's "now" formatting is unchanged.
- The time of saving is the server's current UTC time of day, the same convention Siri rows and Modify use.
- A future day is checked against the latest calendar day on Earth (UTC+14), so the user's own "today" is never refused whatever their timezone.
