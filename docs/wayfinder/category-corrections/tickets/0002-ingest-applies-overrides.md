# New Transactions are born with the remembered Category

status: closed (2026-10-12)
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0001

## What to build

When a Transaction is ingested, the parse still happens through the single LLM call. After the parse, if the Merchant of a parsed Transaction's Motive has a Category Override, the override's Category is the one written to the sheet. Merchants without an override keep the LLM's Category. If the overrides can't be read, ingest logs the error and writes the LLM's Categories, so a Transaction is never lost.

Demo: with an override Las Brumas → Dining Out in place, POST "N1co*las Brumas N1co 12.50". The row lands as Dining Out.

## Acceptance criteria

- [x] Ingest applies the matching override's Category to each parsed Transaction before appending it.
- [x] Multi-transaction inputs apply overrides per Transaction.
- [x] Transactions from Merchants with no override keep the LLM's Category.
- [x] A failure to read overrides does not fail ingest.
- [x] The response `data` reflects the Categories that were actually written.
- [x] Tests at the existing `POST /api/track-expense` integration seam cover:
  - an override applied
  - no override
  - a mixed multi-transaction input
  - an overrides read failure
- [x] Lint, type-check and the full test suite pass.

## Resolution

Built test-first at the `POST /api/track-expense` seam, in a new mocked-services test next to the integration test: `__tests__/app/api/track-expense/route.overrides.test.ts` (5 tests). It mocks the LLM factory and points the spreadsheet factory at `MockSpreadsheetService`.

- **Why not the existing integration test.** `route.integration.test.ts` runs a real LLM against the real sheet. It can't exercise overrides deterministically, because the LLM's Motive and Category vary from run to run. Seeding an override there would also mean writing the production `CategoryOverrides` sheet, since its name isn't configurable the way the Transactions tab is. That test is unchanged, and it now also reads (never writes) the production overrides during ingest.
- **Route.** After the single LLM parse, the route reads all overrides once. For each parsed Transaction, it replaces the Category with the override whose Merchant matches `merchantName(motive)` under `sameMerchant`, so `N1CO*LAS BRUMAS` picks up a "Las Brumas" override. The response `data` is the overridden list, which is the same list that was appended.
- **Read failure.** If reading the overrides throws, the route logs it with `console.error` and appends the LLM's Categories. The Transaction is still logged and the request returns 200.
- **Addition beyond the ticket.** An override whose Category is not in `EXPENSE_CATEGORIES` is ignored, and the LLM's Category is kept. Overrides can be hand-edited in the sheet (user story 15), and this keeps an unknown Category out of the Transactions sheet. It is covered by a test.
- Tests cover: an override applied, no override, a mixed multi-transaction input (including the upper-case variant), an overrides read failure, and an invalid hand-edited override.
