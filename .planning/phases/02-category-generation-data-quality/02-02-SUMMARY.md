---
phase: 02-category-generation-data-quality
plan: 02
subsystem: spreadsheet-service, api-route
tags: [idempotency, duplicate-detection, category-validation, data-quality]
dependency_graph:
  requires: [02-01]
  provides: [CAT-04, CAT-05, CAT-06]
  affects: [src/app/services/spreadsheet, src/app/api/track-expense]
tech_stack:
  added: []
  patterns: [UUID-based idempotency, Uncategorized fallback, runtime enum validation]
key_files:
  created: []
  modified:
    - src/app/services/spreadsheet/types.ts
    - src/app/services/spreadsheet/google-sheets-service.ts
    - src/app/services/spreadsheet/mock-service.ts
    - src/app/api/track-expense/route.ts
decisions:
  - "DuplicateRequestError re-thrown before generic catch to prevent wrapping in SpreadsheetWriteError"
  - "MockSpreadsheetService updated with _requestId parameter to satisfy interface contract"
  - "InvalidInputError path now persists Uncategorized row instead of returning 400, making parse failures recoverable"
metrics:
  duration: 100s
  completed: 2026-02-20
  tasks_completed: 2
  files_modified: 4
---

# Phase 02 Plan 02: UUID Duplicate Detection and Category Validation Summary

UUID-based idempotency (X-Request-ID -> column F dedup), runtime EXPENSE_CATEGORIES validation with Uncategorized fallback, and InvalidInputError persistence path instead of silent 400 drop.

## What Was Built

### Task 1: UUID Column and Duplicate Detection in GoogleSheetsService

- Added `DuplicateRequestError` class to `types.ts` with `requestId` in message
- Updated `SpreadsheetService` interface: `appendTransaction(data, requestId?)`
- Added private `findByRequestId(requestId)` method reading `Transactions!F:F` column
- Updated `appendTransaction` to check for duplicate before any write
- Updated row mapping to include `requestId` as 6th column (empty string if absent)
- Updated append range from `A:E` to `A:F`
- Updated read-after-write verification range from `A:E` to `A:F`
- Updated log message to include `requestId` when present
- Fixed catch block to re-throw `DuplicateRequestError` before wrapping in `SpreadsheetWriteError`
- Updated `MockSpreadsheetService.appendTransaction` signature to match interface

### Task 2: UUID Extraction, Category Validation, Uncategorized Fallback in route.ts

- Extract `X-Request-ID` header with `crypto.randomUUID()` fallback
- Import `EXPENSE_CATEGORIES` from constants for runtime validation
- Added validation loop: unknown category triggers `console.warn` and override to `Uncategorized`
- Changed `appendTransaction` call to pass `validatedData` + `requestId`
- Added `DuplicateRequestError` catch returning 409 with descriptive message
- Replaced `InvalidInputError` 400 return with Uncategorized fallback persist to Sheets (returns 200)
- Fallback persist also uses same `requestId` making retries idempotent

### Checkpoint: human-verify

Auto-approved (auto_advance=true). End-to-end verification deferred to human with live API keys.

## Decisions Made

1. **DuplicateRequestError re-thrown before generic catch** - The `appendTransaction` catch block was wrapping all errors in `SpreadsheetWriteError`. Added explicit re-throw for `DuplicateRequestError` so the route can distinguish a 409 from a 500.

2. **MockSpreadsheetService updated with `_requestId` parameter** - Required to satisfy the updated `SpreadsheetService` interface. The mock ignores the parameter (prefixed with `_`) since test scenarios don't require dedup logic.

3. **InvalidInputError now persists instead of returning 400** - Ensures every submitted expense is captured in Sheets even if categorization fails. The raw transaction text (truncated to 500 chars) becomes the motive, amount=0, category=Uncategorized.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Re-throw DuplicateRequestError in catch block**
- **Found during:** Task 1
- **Issue:** The existing catch block in `appendTransaction` caught all errors and wrapped them in `SpreadsheetWriteError`. Without an explicit re-throw, `DuplicateRequestError` would be wrapped and lost, breaking the 409 response path.
- **Fix:** Added `if (error instanceof DuplicateRequestError) { throw error; }` at the top of the catch block.
- **Files modified:** `src/app/services/spreadsheet/google-sheets-service.ts`
- **Commit:** 461bd84

**2. [Rule 3 - Blocking Issue] Update MockSpreadsheetService to match interface**
- **Found during:** Task 1
- **Issue:** `MockSpreadsheetService.appendTransaction` had the old signature without `requestId?` parameter, causing TypeScript to fail the interface compliance check.
- **Fix:** Added `_requestId?: string` parameter to the mock's `appendTransaction` method.
- **Files modified:** `src/app/services/spreadsheet/mock-service.ts`
- **Commit:** 461bd84

## Self-Check: PASSED

Files verified:
- `src/app/services/spreadsheet/types.ts` - DuplicateRequestError present
- `src/app/services/spreadsheet/google-sheets-service.ts` - findByRequestId, A:F ranges, requestId param
- `src/app/services/spreadsheet/mock-service.ts` - interface-compatible signature
- `src/app/api/track-expense/route.ts` - X-Request-ID, EXPENSE_CATEGORIES, validatedData, DuplicateRequestError catch, Uncategorized fallback
- `npx tsc --noEmit` passes with zero errors

Commits verified:
- 461bd84: feat(02-02): add UUID column and duplicate detection to GoogleSheetsService
- 6d122d1: feat(02-02): add UUID extraction, category validation, and Uncategorized fallback to route
