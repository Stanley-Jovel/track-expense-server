# 0001: Add button prototype

status: closed (2026-10-16)
assignee: stanley (claude session, 2026-10-16)
labels: wayfinder:prototype
blocked-by: —

## Question

Where does the Add Entry button live on the dashboard, and how should a saved entry be highlighted in the list?

## Asset

A prototype on branch `prototype/add-entry`, following the Modify editor prototype (`docs/wayfinder/modify-entry/0001-modify-editor-prototype.md`): three variants on `/dashboard` via `?variant=A|B|C`, with a dev-only floating switcher and saves held in memory.

- A, Floating "+": a round button at the bottom right, within thumb reach.
- B, Header "+": a button in the dashboard header, next to refresh.
- C, List row: an "Add" row at the top of the transaction list.

Commits c217979 and 432ed3c. Every variant opens the same Entry sheet in add mode (`modify-sheet.tsx` with an add mode bolted on): empty fields, an Expense/Income toggle defaulting to Expense, Category from the list, and the day defaulting to today. On save, the new entry is briefly highlighted where it lands in the list, including a backdated entry far down the list.

## Acceptance criteria

- [x] The three variants are reachable via `?variant=A|B|C` on the branch, and checked at 375px.
- [x] The user tries them and picks one.
- [x] The resolution, and anything about the sheet in add mode or the highlight the user wants changed, is recorded below and in the map's Decisions so far.

## Resolution

**C (List row) wins:** an "Add an entry" row at the top of the Entries list. Carried over from the prototype:

- The sheet in add mode: empty fields, the Expense/Income toggle, the day defaulting to today with future days refused, no Category Override checkbox.
- After saving, the new entry is scrolled to and briefly highlighted. When the current filters hide it, a short note ("Added for Sep 28, 2026 · not in this view") shows instead.

Changed by the user after seeing it: **Category is optional.** The row is labelled "optional" and starts on "Guess it for me", with a note that a blank Category is guessed from the name and can be changed afterwards with Modify. While the guess runs, Save reads "Guessing category…". If no Category can be chosen, nothing is saved and the user has to pick one. The prototype's "(guessed)" label on the row is not carried over: nothing marks a guessed row once saved.
