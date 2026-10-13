# Correct a Merchant's Category from the dashboard

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: —

## What to build

On the dashboard entries list, the user taps a Transaction's Category, picks the right one from the fixed list, and saves. The save does three things:

- Records a Category Override for that Transaction's Merchant in a new `CategoryOverrides` sheet. Saving again for the same Merchant replaces the earlier override.
- Rewrites the Category cell of every existing row whose Motive clusters to that Merchant, touching only the Category column, in the real sheet.
- Refreshes the dashboard so the change shows everywhere at once.

See the map's Implementation Decisions for storage, keying, row identity and write scope.

Demo: tap the Las Brumas entry, choose Dining Out, and every Las Brumas row (in the sheet and on the dashboard) is now Dining Out.

## Acceptance criteria

- [ ] The spreadsheet service, both the real one and the mock, can read all overrides, upsert one override, and batch-rewrite Category cells for given rows.
- [ ] Reading rows keeps each row's sheet row number.
- [ ] The correction server action rejects a Category that isn't in the fixed list.
- [ ] The action upserts the override.
- [ ] The action rewrites only rows whose Motive's Merchant matches and whose Category differs, and returns the count.
- [ ] The action busts the transactions cache and the dashboard path.
- [ ] The dashboard entries list shows a tap target on each Category, which opens a native picker with an "applies to all \<Merchant\> expenses" hint.
- [ ] A failed save shows an inline error.
- [ ] It works at 375px.
- [ ] Tests at the correction-action seam, against the mock service, cover:
  - Merchant variants are repaired together.
  - Other Merchants are untouched.
  - Only the Category column changes.
  - A second correction replaces the first.
  - An invalid Category is rejected.
- [ ] GLOSSARY.md defines Category Override and updates Merchant (it now keys overrides).
- [ ] The dashboard-v2 map's "existing rows are never edited" note records the reversal for the Category column.
- [ ] Lint, type-check and the full test suite pass.

## Resolution
