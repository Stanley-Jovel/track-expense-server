# Map: Add Entry

labels: `wayfinder:map`, `ready-for-agent`
tickets: [tickets/](tickets/)
status: open

## Problem Statement

The only way to log a Transaction is the ingest endpoint: an Apple Pay automation, or free text I speak or type into a Siri Shortcut. That falls short in three cases:

- I'm already on the dashboard and don't want to switch to Siri.
- The expense happened earlier (cash, something I forgot, a trip). Ingest always stamps "now", so a backdated entry ends up on the wrong day until I Modify it.
- I want exact control over the fields, without the LLM guessing the Motive, amount, Type or day.

Income is supposed to be "entered manually", which today means typing a row into the sheet by hand.

## Solution

An **"Add an entry"** row at the top of the Entries list opens the same bottom sheet as Modify, in add mode with empty fields. I set the Type (Expense or Income), name, amount and day, and optionally the Category, then save. If I leave the Category blank, one is chosen on save, the same way Siri entries get theirs, and I can change it afterwards with Modify. If none can be chosen, nothing is saved and I pick one myself. The row is appended to the sheet, the dashboard refreshes, and the new entry is briefly highlighted where it lands in the list.

## User Stories

1. As the user, I want to add an entry from the dashboard, so that I don't have to switch to Siri.
2. As the user, I want to pick a past day for the entry, so that a cash or forgotten expense lands on the right day.
3. As the user, I want the day to default to today, so that the common case takes no extra taps.
4. As the user, I want a future day to be refused, so that the ledger only records what already happened.
5. As the user, I want to choose Expense or Income, defaulting to Expense, so that I can stop hand-editing the sheet for Income.
6. As the user, I want switching to Income to set the Category to Income (still changeable), and switching back to Expense to clear it, so that I can't save an Expense as Income by accident.
7. As the user, I want the Category to be optional, and the sheet to say so, so that I can add an entry without deciding where it's filed.
8. As the user, I want a blank Category chosen on save the way Siri entries get theirs (my Category Override for the Merchant first, otherwise the LLM), so that a manual entry is filed as well as an automatic one.
9. As the user, I want to change a chosen Category afterwards with Modify, so that a wrong guess is one swipe away from fixed.
10. As the user, I want the entry not saved when no Category can be chosen, with my input kept, so that nothing lands in the sheet without a Category I've seen.
11. As the user, I want a Category I pick to come from my list, the same as Modify, and to stand even if the Motive's Merchant has a Category Override, so that my explicit choice wins.
12. As the user, I want the same sheet, fields and validation messages as Modify, so that adding and modifying feel like one thing.
13. As the user, I want Save disabled while it runs, so that a double tap doesn't log the entry twice.
14. As the user, I want a failed save to show its error in the sheet and keep my input, so that I never lose what I typed or wrongly think it was saved.
15. As the user, I want the new entry briefly highlighted after saving, and a note when the current filters hide it, so that I can see it was saved and where it landed, even when it's backdated far down the list.
16. As the user, I want the whole flow comfortable on my iPhone, so that it fits how I use the dashboard.

## Implementation Decisions

- **Same as Modify by default.** Anything not decided below behaves as Modify does: a plain-text Motive, an amount greater than $0 rounded to cents, a YYYY-MM-DD day, `{ ok: true } | { ok: false, error }` results, `useTransition` with Save disabled while pending, and `refreshDashboard()` after a write.
- **The Add button is a list row** (variant C of 0001): "Add an entry" at the top of the Entries list.
- **One Entry sheet.** `modify-sheet.tsx` becomes a shared Entry sheet with `mode: 'add' | 'modify'`, reusing as much as possible (DRY). Add mode starts empty, shows a Type toggle, marks Category "optional" with "Guess it for me" as its first option and a note beneath it, and hides the "all from Merchant" checkbox. Save reads "Guessing category…" while a blank Category is being chosen. Modify mode is unchanged.
- **A picked Category** must be on the list. Column F is left blank and Category Overrides are not applied.
- **A blank Category is chosen on save by the ingest path:** a Category Override for the Motive's Merchant wins with no LLM call. Otherwise `parseTransaction` is called on a line built from the entry (such as `Expense: Farmers market $8.75`), and only its Category and suggestion are used; the entry's own Type, Motive, amount and day always win. The suggestion goes through `checkSuggestion` like ingest, so it can land in F and the Review deck. Blank Income takes the same path (the LLM never suggests for Income).
- **A failed choice saves nothing.** If the Category list or every LLM provider fails, `addTransaction` returns "Couldn't guess a category. Pick one or try again." and the sheet keeps the input.
- **Nothing marks a guessed row** once saved. No new column.
- **Type and Category.** Switching to Income sets Category to `Income`. Switching back to Expense clears it (back to "Guess it for me").
- **After saving,** the new entry is scrolled to and briefly highlighted. When the current filters hide it, a short note ("Added for <day> · not in this view") shows instead.
- **Time of day.** The row is stamped with the time of saving on the chosen day, so an entry for today sorts correctly among same-day Siri rows.
- **One write path to Sheets.** The `appendTransaction` input gains an optional `date?: Date`. When it is missing (the Siri ingest path), now is used as before, so the ingest route doesn't change. The mock service gets the same change.
- **Shared validation.** The field checks inside `modifyTransaction` (Motive, amount, day, closed Category list) move into one helper used by both `modifyTransaction` and the new `addTransaction`. Modify keeps its own rule allowing the row's existing out-of-list Category. Add also validates Type (`Income` or `Expense`), rejects future days, and accepts a blank Category.
- **Shared Category choosing.** The Override-then-LLM-then-`checkSuggestion` steps in the ingest route are shared with `addTransaction` rather than copied.
- **A new `addTransaction` server action** in `src/app/dashboard/actions.ts`, commented and validated like its neighbours ("A server action is a public endpoint").
- **No duplicate detection.** A duplicate is one swipe from Delete.
- **No auth,** consistent with the rest of the app.

## Testing Decisions

- **Server-action tests** for `addTransaction` against the mock spreadsheet service, modeled on `__tests__/app/dashboard/modify-transaction.test.ts`. They cover:
  - an Expense and an Income appended with the chosen day and Category, and F blank
  - a backdated day being kept
  - a future day, an unknown Category, an empty Motive, a non-positive amount and an invalid Type each refused with nothing written
  - an Override for the Motive's Merchant not changing a picked Category
  - a blank Category filed by the Merchant's Override with no LLM call
  - a blank Category filed by the (mocked) LLM, with its suggestion written to F, and the LLM's own amount, Type or Motive ignored
  - a blank Category with a failing LLM refused with nothing written
- The LLM is mocked through the LLM factory, as in the ingest route tests.
- **The existing tests still pass unchanged:** `modifyTransaction` after the validation refactor, and the ingest route after the optional `date` is added.
- There are no component tests, matching the repo. The sheet is checked by hand at 375px and on the user's iPhone.

## Out of Scope

- A free-text "describe it" box that pre-fills the whole form through the LLM. Siri already covers free text. (Only the Category is ever guessed.)
- Adding a new Category from the Add sheet.
- Marking guessed rows after save.
- An "all from Merchant" Category Override from the Add sheet. Modify does that.
- Time-of-day editing.
- Duplicate detection.
- "Save and add another".
- Auth.

## Further Notes

- **Done means** shipped to main and verified on the user's iPhone: a backdated cash Expense with a blank Category and an Income entry are added from the dashboard, both land on the right day, and the blank one gets a sensible Category.
- **Tracker:** local markdown, like the other maps. Tickets live in `tickets/`, one file each, with `status`, `assignee`, `labels` and `blocked-by` header fields.
- **Shipping** means merging to main, which Vercel auto-deploys in about 8 minutes. No PR.
- **UI decisions are made from a prototype,** never by prose questions. The prototype is on branch `prototype/add-entry`: run `npm run prototype:add`, then open `/dashboard` (variant C is the default). It is the visual reference; rewrite it properly rather than copying it.
- **Carried constraints:** mobile-first, no database, Sheets is the source of truth. Consult [GLOSSARY.md](../../../GLOSSARY.md).

## Decisions so far

<!-- one line per closed ticket -->
- 0001 (2026-10-16): The list row (C) won over a floating "+" (A) and a header "+" (B). After seeing it, the user made Category optional: a blank one is chosen on save by the ingest path (Override, then LLM), changeable with Modify, and a failed choice saves nothing. No lasting "guessed" marker.
- 0002 (2026-10-16): `addTransaction` shipped test-first. Ingest's filing steps (Override, then suggestion checks) now live in `services/categories/file-transactions.ts` and are shared with it. `appendTransaction` takes an optional timestamp, written as UTC. A future day is any day past the latest one on Earth (UTC+14).
