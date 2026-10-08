# Inspect live sheet data shape

status: closed
assignee: claude-research
labels: wayfinder:research
blocked-by: (none)

## Question

What do Transactions rows actually look like when read back through the Sheets API, and what must the read path account for? Using the credentials in `.env`, read a sample (first rows, last rows, total row count) of the Transactions sheet and the Categories sheet, and establish:

- Is there a header row?
- Exact timestamp format as returned (does `USER_ENTERED` mean Sheets re-typed it as a date serial? what does `valueRenderOption: FORMATTED_VALUE` vs `UNFORMATTED_VALUE` return?) and the reliable way to parse it into a Date.
- Amount format as returned (string? number? currency symbols? negatives?).
- Do all rows conform to the A:E schema (timestamp, motive, amount, type, category), or are there legacy/malformed rows (e.g. from older automations) the parser must tolerate?
- Approximate row count (sanity check for the load-everything strategy).
- What the Categories sheet contains and whether the dashboard needs it at all.

Write any scripts in the scratchpad, not the repo.

## Resolution

Inspected live on 2026-10-08 with a read-only scratchpad script (Node 22 — note: `node_modules/buffer-equal-constant-time` crashes under Node 25, SlowBuffer removal) using the service-account creds in `.env`.

**Sheets in the spreadsheet:** `Transactions`, `Analysis`, `Test`. There is **no `Categories` sheet** — the `Categories` name hardcoded in `google-sheets-service.ts` points at nothing and any read of it fails with "Unable to parse range". The dashboard does not need it; the category vocabulary can be derived from column E (24 distinct values observed, including an `Income` category and bookkeeping ones like `Transfers`, `Investments & Savings`). `Analysis` is a pivot (SUM of Amount by Year-Month x Category) maintained in-sheet; `Test` holds only a header row.

**Transactions shape:**
- Header row present: row 1 = `Datetime | Motive | Amount | Type | Category`. Skip exactly one row.
- Total rows returned: 663 (1 header + **662 data rows**). Load-everything is trivially fine.
- **Schema conformance: 100%.** Scanned all 662 data rows: 0 wrong column count, 0 unparseable amounts, 0 unparseable dates, 0 bad types. Type values: 658 `Expense`, 4 `Income`. No legacy/malformed rows.
- **Timestamps:** `USER_ENTERED` writes did get re-typed by Sheets as real date serials.
  - `UNFORMATTED_VALUE` returns a JS `number` (Sheets serial, days since 1899-12-30, local sheet time): e.g. `45659`, `46189.71658564815`.
  - `FORMATTED_VALUE` returns strings in **two different display formats** (`"1/2/2025 0:00:00"` early rows vs `"06/16/2026, 17:11:53"` later rows), so string parsing is unreliable.
- **Amounts:** `UNFORMATTED_VALUE` → plain `number` (e.g. `38.13`, `29`); `FORMATTED_VALUE` → currency string (`"$38.13"`). No negatives observed; sign is conveyed by the `Type` column instead.

**Sample rows (UNFORMATTED | FORMATTED):**
```
[45659, "Safeway #1885 Seattle WA", 38.13, "Expense", "Groceries"]            | ["1/2/2025 0:00:00", ..., "$38.13", ...]
[45659, "Spirit Airl 487042 800-7727117 FL", 146.37, "Expense", "Travel"]
[46189.71658564815, "H Diagnostico Medica Caja", 186.01, "Expense", "Medical & Pharmacy"] | ["06/16/2026, 17:11:53", ..., "$186.01", ...]
[46192.07010416667, "Wompi*la Esquina Mexican", 27.06, "Expense", "Dining Out"]
[46215.09716435185, "Selectos San Luis", 12, "Expense", "Dining Out"]
```

**Recommended read-path parsing:**
- Fetch `Transactions!A2:E` with `valueRenderOption: 'UNFORMATTED_VALUE'` (and `dateTimeRenderOption: 'SERIAL_NUMBER'`). Avoid FORMATTED_VALUE entirely — its date strings are format-inconsistent and amounts carry `$`.
- Parse dates from the serial: `new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000))` — the serial has no timezone, so treat it as wall-clock time and keep date math in UTC to avoid DST shifts.
- Amount is already a `number`; use it as-is. Type is `'Income' | 'Expense'`; still validate defensively but no malformed rows exist today.
- Drop the `Categories` sheet dependency; derive the category list from distinct column-E values.

