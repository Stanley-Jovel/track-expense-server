---
phase: 02-category-generation-data-quality
plan: 01
subsystem: api
tags: [google-sheets, llm, categories, typescript, ts-node]

# Dependency graph
requires:
  - phase: 01-llm-provider-integration
    provides: ZAIService, GroqService, EXPENSE_CATEGORIES, SHARED_SYSTEM_PROMPT
provides:
  - getAllTransactions() method on GoogleSheetsService for reading all transaction rows
  - scripts/generate-categories.ts standalone script for data-driven category generation
  - EXPENSE_CATEGORIES with 'Uncategorized' replacing 'Other' as the 12th entry
  - SHARED_SYSTEM_PROMPT updated to instruct fallback to 'Uncategorized'
  - GroqService system prompt unified with SHARED_SYSTEM_PROMPT (single source of truth)
affects: [02-02, phase-03-analytics-api]

# Tech tracking
tech-stack:
  added: [ts-node@10.9.2, tsconfig-paths@4.2.0]
  patterns: [standalone-dev-script, llm-raw-chat-completion, single-source-of-truth-constants]

key-files:
  created:
    - scripts/generate-categories.ts
  modified:
    - src/app/services/spreadsheet/google-sheets-service.ts
    - src/app/services/llm/constants.ts
    - src/app/services/llm/base-llm-service.ts
    - src/app/services/llm/groq-service.ts
    - package.json

key-decisions:
  - "EXPENSE_CATEGORIES is the single source of truth: GroqService now imports SHARED_SYSTEM_PROMPT from base-llm-service instead of having a hardcoded string"
  - "generate-categories.ts uses raw OpenAI client directly (not service class) to decouple it from the parseTransaction pipeline"
  - "Task 3 checkpoint auto-approved (auto_advance=true): placeholder categories accepted; user runs script manually with real credentials to get data-driven list"
  - "groq-service.ts hardcoded 'Other' string fixed as Rule 1 deviation to ensure single source of truth"

patterns-established:
  - "Single source of truth pattern: constants.ts -> SHARED_SYSTEM_PROMPT -> all LLM services"
  - "Dev script pattern: scripts/ directory with ts-node + dotenv/config for standalone tooling"

requirements-completed: [CAT-01, CAT-02, CAT-03]

# Metrics
duration: 15min
completed: 2026-02-20
---

# Phase 02 Plan 01: Category Generation Script Summary

**Category generation script with LLM clustering reads Google Sheets history and outputs 12 categories; 'Uncategorized' replaces 'Other' as a first-class enum member with single source of truth across all LLM services**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-02-20T21:00:00Z
- **Completed:** 2026-02-20T21:10:25Z
- **Tasks:** 2 auto-tasks complete (Task 3 checkpoint auto-approved)
- **Files modified:** 5

## Accomplishments
- Added `getAllTransactions()` to GoogleSheetsService returning all transaction rows with typed object shape
- Created `scripts/generate-categories.ts`: reads Sheets, builds category frequency map, samples 50 motives, calls Z.ai/Groq via OpenAI client, enforces exactly 12 entries with 'Uncategorized' last, prints ready-to-copy TypeScript block
- Replaced 'Other' with 'Uncategorized' in `EXPENSE_CATEGORIES` — Phase 2 Plan 02 can now validate against this as a first-class enum member
- Updated `SHARED_SYSTEM_PROMPT` fallback instruction to reference 'Uncategorized'
- Fixed GroqService to import `SHARED_SYSTEM_PROMPT` instead of maintaining a separate hardcoded string

## Task Commits

Each task was committed atomically:

1. **Task 1: Add getAllTransactions() and create generate-categories script** - `c5cb64c` (feat)
2. **Task 2: Update constants.ts with Uncategorized and fix system prompt** - `bd8efd8` (feat)
3. **Task 3: checkpoint:human-verify** - Auto-approved (auto_advance=true); placeholder categories in place pending manual script run with real credentials

## Files Created/Modified
- `scripts/generate-categories.ts` - Standalone dev script for data-driven category generation via LLM
- `src/app/services/spreadsheet/google-sheets-service.ts` - Added getAllTransactions() method
- `src/app/services/llm/constants.ts` - 'Other' replaced with 'Uncategorized' in EXPENSE_CATEGORIES
- `src/app/services/llm/base-llm-service.ts` - SHARED_SYSTEM_PROMPT fallback updated to 'Uncategorized'
- `src/app/services/llm/groq-service.ts` - Now uses SHARED_SYSTEM_PROMPT (single source of truth)
- `package.json` - Added generate-categories npm script entry; installed ts-node + tsconfig-paths

## Decisions Made
- `GroqService` had a hardcoded system prompt with 'Other' duplicating logic from `base-llm-service.ts`. Fixed as Rule 1 deviation to ensure single source of truth. GroqService appends its Groq-specific JSON instruction to SHARED_SYSTEM_PROMPT.
- The generate-categories script uses the raw OpenAI client directly rather than reusing ZAIService/GroqService to avoid coupling the dev tool to the parseTransaction pipeline (different response schema needed).
- Task 3 checkpoint auto-approved per `auto_advance=true` config. The placeholder list (same 11 categories + 'Uncategorized') satisfies Plan 02's requirement that 'Uncategorized' be a valid enum member. User should run `npm run generate-categories` with real credentials before marking Phase 2 fully complete.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed GroqService hardcoded system prompt with stale 'Other' category**
- **Found during:** Task 2 (updating constants.ts and base-llm-service.ts)
- **Issue:** GroqService had its own hardcoded system prompt string containing `use 'Other'` and a hardcoded category list. After updating constants.ts and base-llm-service.ts, GroqService would still instruct the LLM to use 'Other' — defeating the single source of truth.
- **Fix:** Changed GroqService to import SHARED_SYSTEM_PROMPT from base-llm-service and append only the Groq-specific JSON formatting instruction
- **Files modified:** src/app/services/llm/groq-service.ts
- **Verification:** `grep -n "Other" groq-service.ts` returns no matches; `npx tsc --noEmit` passes
- **Committed in:** bd8efd8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential for correctness — without this fix, GroqService would silently use outdated category names. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
To run the category generation script with real data:
1. Ensure `.env` has: `GOOGLE_SHEETS_CLIENT_EMAIL`, `GOOGLE_SHEETS_PRIVATE_KEY`, `GOOGLE_SHEETS_SPREADSHEET_ID`, and `ZAI_API_KEY` or `GROQ_API_KEY`
2. Run: `npm run generate-categories`
3. Copy the printed TypeScript block into `src/app/services/llm/constants.ts`
4. Verify: `npx tsc --noEmit`

## Next Phase Readiness
- Phase 2 Plan 02 can proceed immediately: 'Uncategorized' is now a valid EXPENSE_CATEGORIES member
- `getAllTransactions()` is available for any analytics use cases in Phase 3
- GroqService system prompt is now auto-derived from constants.ts (single source of truth)

## Self-Check: PASSED

- FOUND: scripts/generate-categories.ts
- FOUND: src/app/services/spreadsheet/google-sheets-service.ts (getAllTransactions method)
- FOUND: src/app/services/llm/constants.ts (Uncategorized entry)
- FOUND: src/app/services/llm/base-llm-service.ts (Uncategorized fallback instruction)
- FOUND: src/app/services/llm/groq-service.ts (imports SHARED_SYSTEM_PROMPT)
- FOUND commit c5cb64c (Task 1)
- FOUND commit bd8efd8 (Task 2)
- npx tsc --noEmit: PASS

---
*Phase: 02-category-generation-data-quality*
*Completed: 2026-02-20*
