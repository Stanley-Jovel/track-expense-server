# Transaction read path with caching

status: closed
assignee: claude (this session)
labels: wayfinder:task
blocked-by: [Inspect live sheet data shape](0001-inspect-live-sheet-data-shape.md)

## Question

(Execution ticket.) Extend the spreadsheet service with a read path: `readTransactions(): Promise<Transaction[]>` on `SpreadsheetService` (and the mock), implemented in `GoogleSheetsService`, fetching the full Transactions sheet and parsing rows per the findings of the inspect ticket (date parsing, amount parsing, tolerating malformed rows — skip and count them rather than throw). Returned `Transaction` adds a parsed `date: Date` to the `ParsedTransaction` fields. Wrap with light caching (Next.js `unstable_cache`/`revalidate` ~60s) so dashboard loads don't hit the Sheets API every time. Unit/integration tests in the style of the existing Jest suite.

## Resolution

Done on branch `dashboard`, commit "Add transaction read path with 60s caching".

- `readTransactions(): Promise<Transaction[]>` added to `SpreadsheetService`, implemented in `GoogleSheetsService` (fetches `Transactions!A2:E` with `UNFORMATTED_VALUE` + `SERIAL_NUMBER`) and `MockSpreadsheetService`. Read failures throw a new `SpreadsheetReadError`.
- **Deviation from the ticketed type**: `Transaction` is not `ParsedTransaction & { date }` — its `category` is a plain `string`, because the sheet is the source of truth and may hold values outside the current LLM category list (the dashboard derives categories from data per the inspect ticket). Everything else matches.
- Pure parser in `src/app/services/spreadsheet/parse-row.ts`: serial → `Date` in UTC (`Date.UTC(1899,11,30) + serial*86400000`), malformed rows skipped and counted (logged via `console.warn`). Unit-tested against the exact serials observed live.
- Caching: `getTransactions()` in `src/app/services/spreadsheet/cached-transactions.ts` wraps the read in `unstable_cache` with `revalidate: 60`; Dates survive the JSON cache via ISO round-trip. Deliberately **not** re-exported from the spreadsheet index so `next/cache` stays out of the Jest-run API route import chain — import it directly in server components.
- Tests: 13 new tests pass (parser unit tests + a guarded live round-trip against the Test tab). `tsc --noEmit` clean. The pre-existing live-LLM failure noted on the map is unchanged.
- **Discovery fixed en route**: `next dev --turbopack` ignores the webpack alias for the `buffer-equal-constant-time` Node-25 shim, so any page touching googleapis crashed in dev. Added `experimental.turbo.resolveAlias` in `next.config.ts` mirroring the shim.
- Verified end-to-end: the smoke `/dashboard` page now renders "662 transactions loaded from the sheet" via `getTransactions()` in the dev server.
