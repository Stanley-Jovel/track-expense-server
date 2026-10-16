# Map: Add Entry

labels: `wayfinder:map`, `ready-for-agent`
tickets: [tickets/](tickets/)
status: open

## Problem Statement

The only way to log a Transaction is the ingest endpoint: an Apple Pay automation, or free text I speak or type into a Siri Shortcut. That falls short in three cases:

- I'm already on the dashboard and don't want to switch to Siri.
- The expense happened earlier (cash, something I forgot, a trip). Ingest always stamps "now", so a backdated entry ends up on the wrong day until I Modify it.
- I want exact control over every field, without the LLM guessing the Motive, Category or Type.

Income is supposed to be "entered manually", which today means typing a row into the sheet by hand.

## Solution

An **Add Entry** action on the dashboard opens the same bottom sheet as Modify, in add mode with empty fields. I set the Type (Expense or Income), name, amount, Category and day, then save. The row is appended to the sheet, the dashboard refreshes, and the new entry is briefly highlighted where it lands in the list.

Where the Add button lives (a floating "+", a "+" in the header, or an "Add" row at the top of the list) is decided by the prototype in 0001.

## User Stories

1. As the user, I want to add an entry from the dashboard, so that I don't have to switch to Siri.
2. As the user, I want to pick a past day for the entry, so that a cash or forgotten expense lands on the right day.
3. As the user, I want the day to default to today, so that the common case takes no extra taps.
4. As the user, I want a future day to be refused, so that the ledger only records what already happened.
5. As the user, I want to choose Expense or Income, defaulting to Expense, so that I can stop hand-editing the sheet for Income.
6. As the user, I want switching to Income to set the Category to Income (still changeable), and switching back to Expense to clear it, so that I can't save an Expense as Income by accident.
7. As the user, I want to pick the Category from my list, the same as Modify, so that the list only grows through the Review deck.
8. As the user, I want the Category I pick to stand even if the Motive's Merchant has a Category Override, so that my explicit choice wins.
9. As the user, I want the same sheet, fields and validation messages as Modify, so that adding and modifying feel like one thing.
10. As the user, I want Save disabled while it runs, so that a double tap doesn't log the entry twice.
11. As the user, I want a failed save to show its error in the sheet and keep my input, so that I never lose what I typed or wrongly think it was saved.
12. As the user, I want the new entry briefly highlighted after saving, so that I can see it was saved and where it landed, even when it's backdated far down the list.
13. As the user, I want the whole flow comfortable on my iPhone, so that it fits how I use the dashboard.

## Implementation Decisions

- **Same as Modify by default.** Anything not decided below behaves as Modify does: a plain-text Motive, an amount greater than $0 rounded to cents, a YYYY-MM-DD day, `{ ok: true } | { ok: false, error }` results, `useTransition` with Save disabled while pending, and `refreshDashboard()` after a write.
- **One Entry sheet.** `modify-sheet.tsx` becomes a shared Entry sheet with `mode: 'add' | 'modify'`, reusing as much as possible (DRY). Add mode starts empty, shows a Type toggle, and hides the "all from Merchant" checkbox. Modify mode is unchanged.
- **The Category list is closed.** Only Categories on the list are accepted. Column F (Suggested Category) is never written, and Category Overrides are not applied.
- **Type and Category.** Switching to Income sets Category to `Income`. Switching back to Expense clears it.
- **Time of day.** The row is stamped with the time of saving on the chosen day, so an entry for today sorts correctly among same-day Siri rows.
- **One write path to Sheets.** The `appendTransaction` input gains an optional `date?: Date`. When it is missing (the Siri ingest path), now is used as before, so the ingest route doesn't change. The mock service gets the same change.
- **Shared validation.** The field checks inside `modifyTransaction` (Motive, amount, day, closed Category list) move into one helper used by both `modifyTransaction` and the new `addTransaction`. Modify keeps its own rule allowing the row's existing out-of-list Category. Add also validates Type (`Income` or `Expense`) and rejects future days.
- **A new `addTransaction` server action** in `src/app/dashboard/actions.ts`, commented and validated like its neighbours ("A server action is a public endpoint").
- **No duplicate detection.** A duplicate is one swipe from Delete.
- **No auth,** consistent with the rest of the app.

## Testing Decisions

- **Server-action tests** for `addTransaction` against the mock spreadsheet service, modeled on `__tests__/app/dashboard/modify-transaction.test.ts`. They cover:
  - an Expense and an Income appended with the chosen day and Category, and F blank
  - a backdated day being kept
  - a future day, an unknown Category, an empty Motive, a non-positive amount and an invalid Type each refused with nothing written
  - an Override for the Motive's Merchant not changing the chosen Category
- **The existing tests still pass unchanged:** `modifyTransaction` after the validation refactor, and the ingest route after the optional `date` is added.
- There are no component tests, matching the repo. The sheet is checked by hand at 375px and on the user's iPhone.

## Out of Scope

- A free-text "describe it" box that pre-fills the form through the LLM. Siri already covers free text.
- Writing a Category Suggestion (column F) or adding a new Category from the Add sheet.
- An "all from Merchant" Category Override from the Add sheet. Modify does that.
- Time-of-day editing.
- Duplicate detection.
- "Save and add another".
- Auth.

## Further Notes

- **Done means** shipped to main and verified on the user's iPhone: a backdated cash Expense and an Income entry are added from the dashboard, and both land on the right day with the right Category.
- **Tracker:** local markdown, like the other maps. Tickets live in `tickets/`, one file each, with `status`, `assignee`, `labels` and `blocked-by` header fields.
- **Shipping** means merging to main, which Vercel auto-deploys in about 8 minutes. No PR.
- **UI decisions are made from a prototype,** never by prose questions. 0001 settles the button placement and the highlight after saving.
- **Carried constraints:** mobile-first, no database, Sheets is the source of truth. Consult [GLOSSARY.md](../../../GLOSSARY.md).

## Decisions so far

<!-- one line per closed ticket -->
