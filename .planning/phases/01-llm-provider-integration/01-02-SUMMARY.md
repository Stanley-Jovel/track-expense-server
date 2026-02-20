---
phase: 01-llm-provider-integration
plan: 02
subsystem: api
tags: [zod, enum, validation, google-sheets, llm, openai, groq, z-ai]

# Dependency graph
requires:
  - phase: 01-llm-provider-integration plan 01
    provides: ZAIService, GroqService, MultiFallbackLLMService, LLMServiceFactory with fallback chain
provides:
  - EXPENSE_CATEGORIES const and ExpenseCategory type (exported from openai-service)
  - Zod enum enforcement on category field in ParsedTransactionsSchema
  - Consistent system prompts across all three providers listing exact 12 categories
  - Read-after-write verification in GoogleSheetsService.appendTransaction
  - .env updated with LLM_PROVIDER, ZAI_API_KEY, GROQ_API_KEY placeholder keys
affects: [phase-02-categories, phase-03-analytics-api, phase-04-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-enum-validation, read-after-write-verification, shared-constants-cross-service]

key-files:
  created: []
  modified:
    - src/app/services/llm/openai-service.ts
    - src/app/services/llm/zai-service.ts
    - src/app/services/llm/groq-service.ts
    - src/app/services/spreadsheet/google-sheets-service.ts

key-decisions:
  - "category field stays as string in ParsedTransaction TypeScript type; enum enforcement is at Zod parse boundary only"
  - ".env is gitignored so LLM_PROVIDER/ZAI_API_KEY/GROQ_API_KEY were added locally only, not committed"
  - "Groq user prompt also updated to enumerate valid categories (since Groq uses json_object not zodResponseFormat)"
  - "Read-after-write verification uses motive field (column B) as the lightweight sanity check to avoid date formatting fragility"

patterns-established:
  - "Shared constants pattern: export from one service, import in others to avoid drift"
  - "Read-after-write pattern: every spreadsheet append is verified by a get call"

requirements-completed: [LLM-04, LLM-06]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 1 Plan 02: Schema Hardening and Sheets Verification Summary

**Zod enum enforcement on 12 categories across all providers + read-after-write verification in Google Sheets with SpreadsheetWriteError on mismatch**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-02-20T17:37:07Z
- **Completed:** 2026-02-20T17:39:30Z
- **Tasks:** 2 auto tasks complete (checkpoint pending user verification)
- **Files modified:** 4

## Accomplishments
- `EXPENSE_CATEGORIES` const exported from `openai-service.ts`, imported and reused by zai-service and groq-service — single source of truth
- `ParsedTransactionsSchema.category` changed from `z.string()` to `z.enum(EXPENSE_CATEGORIES)` — LLM responses with unknown categories now throw Zod parse errors
- All three provider system prompts updated to explicitly enumerate all 12 allowed categories, reducing hallucinated category values
- `GoogleSheetsService.appendTransaction` now performs a `values.get` read-back after every `values.append` call, throwing `SpreadsheetWriteError` with message "Write verification failed" if the last row doesn't match

## Task Commits

Each task was committed atomically:

1. **Task 1: Enforce 12-category enum in schema and system prompts** - `b933bc4` (feat)
2. **Task 2: Add read-after-write verification and update env config** - `a51bfbb` (feat)

## Files Created/Modified
- `src/app/services/llm/openai-service.ts` - Added EXPENSE_CATEGORIES export, changed category to z.enum, updated system prompt with category list
- `src/app/services/llm/zai-service.ts` - Imported EXPENSE_CATEGORIES, updated system prompt with category list
- `src/app/services/llm/groq-service.ts` - Imported EXPENSE_CATEGORIES, updated system prompt and user prompt with category list
- `src/app/services/spreadsheet/google-sheets-service.ts` - Added values.get read-back after every append (LLM-06)

## Decisions Made
- **category stays as string in ParsedTransaction TypeScript type** — plan explicitly said not to change types.ts to avoid breaking changes; Zod enum is the enforcement boundary
- **.env is gitignored** — LLM_PROVIDER/ZAI_API_KEY/GROQ_API_KEY were added to local .env but not committed (correct security posture for API keys)
- **Groq user prompt also updated** — since GroqService uses json_object (not zodResponseFormat), the user prompt must explicitly list valid category values for the model to use them
- **Read-back uses motive field (column B)** — avoids fragility from timestamp formatting differences between write and read

## Deviations from Plan

None - plan executed exactly as written.

Note: The plan referenced `.env.local` but the project uses `.env` (discovered during Task 2). Updated `.env` instead — same intent, same outcome.

## Issues Encountered
- Plan referenced `.env.local` but the project only has `.env`. Updated `.env` instead. This is the correct file as Next.js reads `.env` before `.env.local`, and the existing OPENAI_API_KEY was already in `.env`. No functionality impact.

## User Setup Required

**External services require API keys before end-to-end verification can pass.**

Fill in these values in your `.env` file:

```
LLM_PROVIDER=z-ai          # already set
ZAI_API_KEY=<your-key>     # get from https://open.bigmodel.cn/ → API Keys
GROQ_API_KEY=<your-key>    # get from https://console.groq.com/ → API Keys
```

Then run the end-to-end verification:

```bash
npm run dev
curl -X POST http://localhost:3000/api/track-expense \
  -H "Content-Type: application/json" \
  -d '{"transaction": "Starbucks coffee $6"}'
```

Expected: response contains category from the 12-item list, terminal shows `[LLM] provider=z-ai` and `[SHEETS] Write verified:`.

## Next Phase Readiness
- Schema hardening complete: invalid categories are rejected at parse time
- All providers use consistent category prompts
- Sheets writes are now verified — no silent failures
- Ready for Phase 2 (category management) once end-to-end checkpoint passes

---
*Phase: 01-llm-provider-integration*
*Completed: 2026-02-20*
