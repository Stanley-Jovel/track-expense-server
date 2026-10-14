# 0004: The Category list lives in the Categories sheet

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0003

## What to build

The Category list and each Category's Spending flag come from a new `Categories` sheet (Category, Counts as Spending, Added-at), not from code. The sheet is created and seeded on first read with today's 25 Categories. Transfers, Investments & Savings and Income are marked as not counting as Spending. If the sheet can't be read, ingest logs the failure and falls back to the built-in list, so no Transaction is lost.

Demo: add a Category by hand in the sheet. The LLM can now choose it, and the Modify sheet and the dashboard's Category filter offer it. Untick its Spending flag, and the Spending totals leave it out.

## Acceptance criteria

- [ ] The spreadsheet service, both real and mock, reads the Categories, creating and seeding the sheet when it's missing.
- [ ] Ingest, the dashboard and the server actions use the list from the sheet.
- [ ] Tests at the ingest seam (the route with a mocked LLM and the mock service):
  - a Category added to the list is accepted
  - when the Categories read fails, the built-in list is used and the Transaction is still logged
- [ ] Aggregate test: a Category flagged as not Spending is excluded from Spending.
- [ ] Right after seeding, the dashboard's Spending totals are identical to before.
- [ ] GLOSSARY.md: Category now says the list lives in the `Categories` sheet and grows only by approval, and the wrong count (26) is fixed.
- [ ] Lint, type-check and the full test suite pass.
