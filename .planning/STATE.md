# PROJECT STATE: Track Expenses

**Project Reference:**
- **Core Value:** Low-cost expense tracking with accurate, predictable categorization and clear visibility into where money goes
- **Current Focus:** Phase 2 (Category generation & data quality) - Plan 01 complete
- **Last Updated:** 2026-02-20

## Current Position

| Attribute | Value |
|-----------|-------|
| **Current Phase** | 02-category-generation-data-quality |
| **Current Plan** | 02 (complete) |
| **Status** | Plan 02-02 complete; UUID dedup + category validation + Uncategorized fallback implemented |
| **Progress** | Roadmap: 1/1 complete. Phase 1: 2 plans complete. Phase 2: 2/2 plans complete. |
| **Last Session** | 2026-02-20T21:15:05Z |
| **Stopped At** | Completed 02-category-generation-data-quality-02-PLAN.md |

## Project State

```
Roadmap:      ████████████████████ 100%
Phase 1:      ████████░░░░░░░░░░░░  ~50% (2 plans executed)
Phase 2:      ██████████░░░░░░░░░░  ~50% (1/2 plans complete)
Phase 3:      ░░░░░░░░░░░░░░░░░░░░   0%
Phase 4:      ░░░░░░░░░░░░░░░░░░░░   0%
```

## Performance Metrics

| Metric | Value | Target |
|--------|-------|--------|
| Requirements coverage | 30/30 (100%) | 100% |
| Phases identified | 4 | 4 |
| Avg success criteria per phase | 5 | 2-5 |
| Depth setting | Quick | Quick |
| Phase 01-llm-provider-integration P01 | 3 min | 2 tasks | 7 files |
| Phase 01-llm-provider-integration P02 | 3min | 2 tasks | 4 files |
| Phase 02-category-generation-data-quality P01 | 15min | 2 tasks | 5 files |
| Phase 02-category-generation-data-quality P02 | 2min | 2 tasks | 4 files |

## Phase Breakdown

| Phase | Requirements | Success Criteria | Estimated Plans |
|-------|--------------|------------------|------------------|
| 1: LLM Provider | 7 | 7 | TBD |
| 2: Categories | 6 | 5 | TBD |
| 3: Analytics API | 7 | 6 | TBD |
| 4: Frontend | 7 | 7 | TBD |
| Cross-cutting | 3 | — | All phases |

## Accumulated Context

### Key Decisions Made

1. **4-Phase Structure** - Derived from research recommendations:
   - Phase 1: LLM provider (cost reduction & abstraction)
   - Phase 2: Category generation (data quality)
   - Phase 3: Analytics API (backend exposure)
   - Phase 4: Frontend dashboard (user visibility)

2. **Provider Stack** - Z.ai primary + Groq fallback + OpenAI last-resort
   - Z.ai GLM-4-Flash (free, OpenAI-compatible via baseURL override)
   - Groq mixtral-8x7b-32768 (~$0.27/1M tokens, fallback 1)
   - OpenAI gpt-4o (last resort, existing)
   - Reduces costs from ~$2/month to $0/month

3. **Google Sheets Persistence** - No database migration
   - Avoids hosting costs
   - Leverages existing infrastructure
   - Scalable to 10K+ transactions

4. **Success Criteria Focus** - Observable user behaviors, not implementation tasks
   - Each criterion verifiable by human user interaction
   - Tied to specific requirements
   - Enables clear "done" definition

5. **Groq uses json_object response format** (not zodResponseFormat)
   - groq-sdk lacks openai/helpers/zod equivalent
   - User prompt augmented with explicit JSON schema
   - Manual validation with isValidParsedExpense()

6. **MultiFallbackLLMService skips fallbacks on InvalidInputError**
   - User input errors are not provider failures
   - Prevents masking bad input with different provider attempts

7. **API route uses createWithFallbacks() in production**
   - Z.ai -> Groq -> OpenAI chain via LLMServiceFactory.createWithFallbacks()
   - NODE_ENV=test still returns MockLLMService (backward compatible)

8. **ParsedTransaction.category stays as string TypeScript type** (Plan 02)
   - Zod enum is the enforcement boundary to avoid breaking changes elsewhere
   - Type can be tightened to ExpenseCategory in a later phase

9. **Read-after-write verification uses motive field (column B)** (Plan 02)
   - Avoids date formatting fragility in comparing expected vs actual row
   - Lightweight sanity check that confirms row exists and matches

10. **EXPENSE_CATEGORIES is single source of truth** (Phase 02 Plan 01)
    - GroqService imports SHARED_SYSTEM_PROMPT from base-llm-service instead of hardcoded string
    - constants.ts change automatically propagates to all LLM services

11. **Uncategorized replaces Other** (Phase 02 Plan 01)
    - First-class enum member (not fallback string)
    - Required for Phase 2 Plan 02 Zod validation

12. **DuplicateRequestError re-thrown before generic SpreadsheetWriteError catch** (Phase 02 Plan 02)
    - Ensures 409 response flows correctly to route; without re-throw it would be wrapped as 500

13. **InvalidInputError path persists Uncategorized row instead of returning 400** (Phase 02 Plan 02)
    - Every submitted expense is captured in Sheets even if categorization fails
    - Fallback uses same requestId making retries idempotent

14. **generate-categories.ts uses raw OpenAI client** (Phase 02 Plan 01)
    - Decoupled from parseTransaction pipeline
    - Different response schema needed for category suggestion task

### Open Questions (None - Research Complete)

Research phase addressed all critical unknowns:
- Z.ai API compatibility: Documented as OpenAI-compatible
- Cost impact: Confirmed ~$0/month (free Z.ai tier)
- Architecture fit: Factory pattern extended with env-var provider selection
- Fallback strategy: Groq + OpenAI provide insurance

### Blockers (None)

No current blockers.

### TODOs

- [x] Review and approve ROADMAP.md
- [x] Start Phase 1 planning with `/gsd:plan-phase 1`
- [x] Implement Phase 1, Plan 01 (ZAIService, GroqService, MultiFallbackLLMService)
- [x] Implement Phase 1, Plan 02 (category enum, system prompts, sheets read-after-write)
- [ ] Fill in ZAI_API_KEY and GROQ_API_KEY in .env and verify end-to-end
- [ ] Validate Z.ai categorization accuracy against OpenAI baseline
- [ ] Execute remaining Phase 1 plans
- [ ] Proceed to Phase 2 upon Phase 1 completion

## Session Continuity

**If context resets:**

1. Current state: Phase 2, Plan 01 complete. Category generation script + Uncategorized enum implemented.
2. Plan summaries: `.planning/phases/02-category-generation-data-quality/02-01-SUMMARY.md`
3. Roadmap location: `.planning/ROADMAP.md`
4. Requirements location: `.planning/REQUIREMENTS.md` (includes traceability)
5. Next action: Execute Phase 2 Plan 02 (category validation in Zod schema)

**Critical files:**
- `.planning/PROJECT.md` - Core value and constraints
- `.planning/REQUIREMENTS.md` - v1 requirements with phase mappings
- `.planning/ROADMAP.md` - Phase structure and success criteria
- `.planning/research/SUMMARY.md` - LLM provider research findings
- `.planning/phases/01-llm-provider-integration/01-01-SUMMARY.md` - Plan 01 completion

**Env vars now required in production:**
- `ZAI_API_KEY` - Z.ai (primary LLM, free)
- `GROQ_API_KEY` - Groq (fallback 1)
- `OPENAI_API_KEY` - OpenAI (fallback 2, already required)
- `LLM_PROVIDER` - Optional override (defaults to z-ai chain)

---

*State initialized: 2026-02-19*
*Last updated: 2026-02-20 (Plan 02-01 complete)*
