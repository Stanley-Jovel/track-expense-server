# Modify an entry from the swipe tray: editor prototype

status: closed (2026-10-14)
assignee: stanley (claude session, 2026-10-14)
labels: wayfinder:prototype

## Question

Swiping an entry left already reveals Delete. Modify should live in the same tray, replacing the separate tap targets on an entry's Category and amount, and edit name (Motive), Category, amount and date together. What should the Modify editor look like?

## Asset

Prototype on branch `prototype/modify-entry` (commit f62a0af): three editors on `/dashboard` via `?variant=A|B|C`, with a dev-only floating switcher and in-memory saves.

- A, Inline drawer: a stacked form unfolds under the row, like Delete's confirmation.
- B, Bottom sheet: a modal sheet slides up; the amount is the headline, with Name / Category / Date as ledger rows beneath.
- C, In place: the row itself turns into its fields.

Every variant asked the same question when an Expense's Category changes: apply it to all of the Merchant's expenses (a Category Override, the default) or only to this entry.

## Resolution (2026-10-14)

**B (Bottom sheet) wins.** It was built on main as the real Modify action. Carried over from the prototype:

- The tray holds Modify and Delete. The row has no inline tap targets.
- The sheet edits name, Category, amount and date. The time of day of the original entry is kept, and Type is not editable.
- Changing an Expense's Category shows a checkbox, checked by default, to save it as a Category Override for the Merchant. Unchecked, only this entry's Category changes.
