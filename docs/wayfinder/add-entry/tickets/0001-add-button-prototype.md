# 0001: Add button prototype

status: open
assignee: —
labels: wayfinder:prototype
blocked-by: —

## Question

Where does the Add Entry button live on the dashboard, and how should a saved entry be highlighted in the list?

## Asset

A prototype on branch `prototype/add-entry`, following the Modify editor prototype (`docs/wayfinder/modify-entry/0001-modify-editor-prototype.md`): three variants on `/dashboard` via `?variant=A|B|C`, with a dev-only floating switcher and saves held in memory.

- A, Floating "+": a round button at the bottom right, within thumb reach.
- B, Header "+": a button in the dashboard header, next to refresh.
- C, List row: an "Add" row at the top of the transaction list.

Every variant opens the same Entry sheet in add mode (`modify-sheet.tsx` with an add mode bolted on): empty fields, an Expense/Income toggle defaulting to Expense, Category from the list, and the day defaulting to today. On save, the new entry is briefly highlighted where it lands in the list, including a backdated entry far down the list.

## Acceptance criteria

- [ ] The three variants are reachable via `?variant=A|B|C` on the branch, and checked at 375px.
- [ ] The user tries them on their iPhone and picks one.
- [ ] The resolution, and anything about the sheet in add mode or the highlight the user wants changed, is recorded below and in the map's Decisions so far.

## Resolution

<!-- filled in when the user picks -->
