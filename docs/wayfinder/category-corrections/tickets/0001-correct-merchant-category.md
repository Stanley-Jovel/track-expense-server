# Correct a Merchant's Category from the dashboard

status: closed (2026-10-12)
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

- [x] The spreadsheet service, both the real one and the mock, can read all overrides, upsert one override, and batch-rewrite Category cells for given rows.
- [x] Reading rows keeps each row's sheet row number.
- [x] The correction server action rejects a Category that isn't in the fixed list.
- [x] The action upserts the override.
- [x] The action rewrites only rows whose Motive's Merchant matches and whose Category differs, and returns the count.
- [x] The action busts the transactions cache and the dashboard path.
- [x] The dashboard entries list shows a tap target on each Category, which opens a native picker with an "applies to all \<Merchant\> expenses" hint.
- [x] A failed save shows an inline error.
- [x] It works at 375px.
- [x] Tests at the correction-action seam, against the mock service, cover:
  - Merchant variants are repaired together.
  - Other Merchants are untouched.
  - Only the Category column changes.
  - A second correction replaces the first.
  - An invalid Category is rejected.
- [x] GLOSSARY.md defines Category Override and updates Merchant (it now keys overrides).
- [x] The dashboard-v2 map's "existing rows are never edited" note records the reversal for the Category column.
- [x] Lint, type-check and the full test suite pass.

## Resolution

Built test-first at the correction server-action seam (`correctMerchantCategory` in `src/app/dashboard/actions.ts`), against `MockSpreadsheetService` (`__tests__/app/dashboard/correct-merchant-category.test.ts`, 7 tests).

- **Service.** `SpreadsheetService` gained `readCategoryOverrides`, `upsertCategoryOverride` and `rewriteCategories`, in both the real and mock services. In the real service, `rewriteCategories` sends one `values.batchUpdate` of single-cell `Transactions!E<row>` ranges, so it can't touch any other column. The `CategoryOverrides` sheet (Merchant, Category, Updated-at) is created with its header on the first upsert. A missing sheet reads as no overrides.
- **Row numbers.** `readTransactions` now returns `SheetTransaction` (a `Transaction` plus `row`). `parseTransactionRows` numbers rows from A2 = 2 and counts skipped malformed rows too, so the numbers stay true sheet rows. A test for this was added to `parse-row.test.ts`.
- **Action.** It validates against `EXPENSE_CATEGORIES`, upserts the override, reads all rows, rewrites only the rows that match and differ, and returns `{ ok: true, repaired }`, or `{ ok: false, error }` on an invalid Category or a failed save. It always busts `sheet-transactions` and `/dashboard` (through `refreshDashboard`) once it has started writing, even after a partial failure.
- **Deviation: Merchants are compared case-insensitively.** This uses the new `sameMerchant()` in `analytics/merchant.ts`. The map's own example `N1CO*LAS BRUMAS` clusters to "LAS BRUMAS", not "Las Brumas", under the unchanged `merchantName()`. A plain equals check would not have corrected the variants together. The override upsert uses the same comparison. **Ticket 0002 should match overrides with `sameMerchant`.** The display-time clustering (Top merchants) still splits those two spellings. That is left as-is.
- **UI.** `EntryCategoryLine` (`src/app/dashboard/category-picker.tsx`) is an invisible native `<select>` stretched over a dotted-underlined Category label. On iOS it opens the wheel. Its font is 16px so the page doesn't zoom, and its tap target is padded. The hint is the `<optgroup>` label "Applies to all <Merchant> expenses", which is also in the aria-label. While saving, the label reads "Saving…". A failure shows an inline `role="alert"` line in `--ledger-up`. Checked at 375px against the live sheet: it renders, with no horizontal scroll. A save was **not** exercised live, to avoid writing the production sheet. On-iPhone QA is left for ticket 0003.
- **Docs.** GLOSSARY.md has Category Override and an updated Merchant entry. The dashboard-v2 map records the reversal for the Category column.

