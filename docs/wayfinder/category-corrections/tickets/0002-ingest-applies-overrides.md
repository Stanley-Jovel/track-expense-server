# New Transactions are born with the remembered Category

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0001

## What to build

When a Transaction is ingested, the parse still happens through the single LLM call. After the parse, if the Merchant of a parsed Transaction's Motive has a Category Override, the override's Category is the one written to the sheet. Merchants without an override keep the LLM's Category. If the overrides can't be read, ingest logs the error and writes the LLM's Categories, so a Transaction is never lost.

Demo: with an override Las Brumas → Dining Out in place, POST "N1co*las Brumas N1co 12.50". The row lands as Dining Out.

## Acceptance criteria

- [ ] Ingest applies the matching override's Category to each parsed Transaction before appending it.
- [ ] Multi-transaction inputs apply overrides per Transaction.
- [ ] Transactions from Merchants with no override keep the LLM's Category.
- [ ] A failure to read overrides does not fail ingest.
- [ ] The response `data` reflects the Categories that were actually written.
- [ ] Tests at the existing `POST /api/track-expense` integration seam cover:
  - an override applied
  - no override
  - a mixed multi-transaction input
  - an overrides read failure
- [ ] Lint, type-check and the full test suite pass.

## Resolution
