# 0003: Wire Add Entry into the dashboard, ship and verify

status: closed (2026-10-16)
assignee: stanley (claude session, 2026-10-16)
labels: wayfinder:task
blocked-by: 0001, 0002

## What to build

- Turn `modify-sheet.tsx` into the shared Entry sheet with `mode: 'add' | 'modify'`, reusing as much as possible. Modify mode is unchanged. Add mode starts empty, shows the Expense/Income toggle (Income sets Category to `Income`, Expense clears it), and hides the "all from Merchant" checkbox.
- Category in add mode is marked "optional", starts on "Guess it for me", and shows the note that a blank Category is guessed from the name and can be changed afterwards with Modify. Save reads "Guessing category…" while it runs.
- Add the "Add an entry" row at the top of the Entries list (variant C), and the highlight after saving with the "not in this view" note, rewritten properly rather than copied from the prototype.
- Call `addTransaction` from 0002. A failed save, including a Category that couldn't be guessed, shows its error inline and keeps the input.
- Add an **Entry** line to `GLOSSARY.md`: a Transaction typed in on the dashboard.
- Merge to main, wait for the Vercel deploy (about 8 minutes), and verify on the user's iPhone.

## Acceptance criteria

- [x] At 375px and on the user's iPhone, a backdated cash Expense with a blank Category and an Income entry are added from the dashboard and land on the right day, the blank one with a sensible Category.
- [x] Changing the chosen Category with Modify works.
- [x] Modify still works as before.
- [x] The map's Decisions so far is updated and its status is set to closed.

## Notes

- 2026-10-16: Shipped to main (0c3bf03) and the Vercel deploy succeeded. `modify-sheet.tsx` was renamed to `entry-sheet.tsx` (`EntrySheet`, with `mode: 'add' | 'modify'`).
- The highlight finds the new entry in the refreshed rows as the last row past the previous highest one with the same Type, Motive and amount. If it never shows up, it gives up quietly after 15s.
- Local checking covered the sheet in add mode at 375px and a failed save (the error shows inline and the input is kept). It didn't cover a successful write: the spreadsheet has no `Test` tab, and local saves would have written to the real Transactions sheet.
- On the user's iPhone in production, a backdated cash Expense with a blank Category and an Income entry both landed on the right day with the right Category, and Modify still works.
