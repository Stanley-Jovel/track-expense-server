# 0003: Wire Add Entry into the dashboard, ship and verify

status: open
assignee: —
labels: wayfinder:task
blocked-by: 0001, 0002

## What to build

- Turn `modify-sheet.tsx` into the shared Entry sheet with `mode: 'add' | 'modify'`, reusing as much as possible. Modify mode is unchanged. Add mode starts empty, shows the Expense/Income toggle (Income sets Category to `Income`, Expense clears it), and hides the "all from Merchant" checkbox.
- Add the Add button the user picked in 0001, and the highlight after saving, rewritten properly rather than copied from the prototype.
- Call `addTransaction` from 0002. A failed save shows its error inline and keeps the input.
- Add an **Entry** line to `GLOSSARY.md`: a Transaction typed in on the dashboard.
- Merge to main, wait for the Vercel deploy (about 8 minutes), and verify on the user's iPhone.

## Acceptance criteria

- [ ] At 375px and on the user's iPhone, a backdated cash Expense and an Income entry are added from the dashboard and land on the right day with the right Category.
- [ ] Modify still works as before.
- [ ] The map's Decisions so far is updated and its status is set to closed.
