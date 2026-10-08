# Transaction read path with caching

status: open
assignee:
labels: wayfinder:task
blocked-by: [Inspect live sheet data shape](0001-inspect-live-sheet-data-shape.md)

## Question

(Execution ticket.) Extend the spreadsheet service with a read path: `readTransactions(): Promise<Transaction[]>` on `SpreadsheetService` (and the mock), implemented in `GoogleSheetsService`, fetching the full Transactions sheet and parsing rows per the findings of the inspect ticket (date parsing, amount parsing, tolerating malformed rows — skip and count them rather than throw). Returned `Transaction` adds a parsed `date: Date` to the `ParsedTransaction` fields. Wrap with light caching (Next.js `unstable_cache`/`revalidate` ~60s) so dashboard loads don't hit the Sheets API every time. Unit/integration tests in the style of the existing Jest suite.
