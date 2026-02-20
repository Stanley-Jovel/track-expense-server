---
phase: 01-llm-provider-integration
plan: 01
subsystem: api
tags: [openai, groq, groq-sdk, z-ai, glm-4-flash, mixtral, llm, provider, factory, fallback]

# Dependency graph
requires: []
provides:
  - ZAIService: GLM-4-Flash via OpenAI SDK baseURL override to open.bigmodel.cn
  - GroqService: mixtral-8x7b-32768 via groq-sdk
  - MultiFallbackLLMService: transparent Z.ai -> Groq -> OpenAI failover chain
  - LLMServiceFactory.create(): reads LLM_PROVIDER env var to select provider
  - LLMServiceFactory.createWithFallbacks(): returns full fallback chain
affects: [02-categories, 03-analytics-api, 04-frontend]

# Tech tracking
tech-stack:
  added: [groq-sdk]
  patterns:
    - Factory pattern extended with env-var-driven provider selection
    - Transparent fallback chain via MultiFallbackLLMService decorator
    - Input sanitization (newlines, prompt injection patterns) before every LLM call
    - Per-call cost/token logging with provider tag

key-files:
  created:
    - src/app/services/llm/zai-service.ts
    - src/app/services/llm/groq-service.ts
    - src/app/services/llm/multi-fallback-service.ts
  modified:
    - src/app/services/llm/factory.ts
    - src/app/services/llm/index.ts
    - src/app/api/track-expense/route.ts
    - package.json

key-decisions:
  - "Groq uses response_format json_object (not zodResponseFormat) since groq-sdk lacks openai/helpers/zod equivalent"
  - "ZAIService uses free-tier costs (0/0 per 1M tokens); GroqService uses $0.27/$0.27 per 1M tokens (mixtral-8x7b)"
  - "MultiFallbackLLMService re-throws InvalidInputError immediately without trying fallbacks"
  - "API route uses createWithFallbacks() in production, preserves mock for NODE_ENV=test"
  - "groq-sdk installed as dependency (not devDependency) since used at runtime"

patterns-established:
  - "LLM provider selection: process.env.LLM_PROVIDER || type in factory, no code changes to swap"
  - "Input sanitization pattern: sanitizeInput() removes [\r\n]+, [System...], {instruction...}, trims, slices 500"
  - "Cost logging pattern: [LLM] provider=X input_tokens=N output_tokens=N total_tokens=N cost_usd=$N"

requirements-completed: [LLM-01, LLM-02, LLM-03, LLM-05, LLM-07]

# Metrics
duration: 3min
completed: 2026-02-20
---

# Phase 01 Plan 01: LLM Provider Integration Summary

**Multi-provider LLM architecture with Z.ai (free) primary, Groq fallback, OpenAI last-resort, and prompt-injection sanitization on every call**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-20T17:31:03Z
- **Completed:** 2026-02-20T17:34:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- ZAIService and GroqService implemented with identical sanitization and cost-logging patterns
- MultiFallbackLLMService transparently chains Z.ai -> Groq -> OpenAI; InvalidInputError bypasses fallbacks
- LLMServiceFactory extended to read LLM_PROVIDER env var; single env change swaps the entire provider
- API route updated to use createWithFallbacks() in production (backward compatible with test mock)
- groq-sdk installed as runtime dependency

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement ZAIService and GroqService** - `0e9f8fb` (feat)
2. **Task 2: Implement MultiFallbackLLMService and extend factory + index** - `91c0d2b` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `src/app/services/llm/zai-service.ts` - GLM-4-Flash via OpenAI SDK with open.bigmodel.cn baseURL, sanitization, free-tier cost logging
- `src/app/services/llm/groq-service.ts` - mixtral-8x7b-32768 via groq-sdk, json_object response format, $0.27/$0.27 cost logging
- `src/app/services/llm/multi-fallback-service.ts` - Wraps primary/fallback1/fallback2; re-throws InvalidInputError immediately
- `src/app/services/llm/factory.ts` - Reads LLM_PROVIDER env var; adds createWithFallbacks() method
- `src/app/services/llm/index.ts` - Adds exports for ZAIService, GroqService, MultiFallbackLLMService
- `src/app/api/track-expense/route.ts` - Production path uses createWithFallbacks(); test path unchanged
- `package.json` - Added groq-sdk dependency

## Decisions Made
- Groq uses `response_format: { type: 'json_object' }` rather than zodResponseFormat because groq-sdk lacks the OpenAI helpers/zod module; the user prompt is augmented with the expected JSON schema
- ZAIService logs cost as $0.000000 (free tier); GroqService uses $0.27/$0.27 per 1M tokens for mixtral-8x7b
- MultiFallbackLLMService re-throws InvalidInputError from primary without fallbacks to avoid masking user input errors
- groq-sdk installed as a runtime dependency (not devDependency)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing groq-sdk dependency**
- **Found during:** Task 1 (Implement ZAIService and GroqService)
- **Issue:** groq-sdk not installed; import would fail at runtime
- **Fix:** Ran `npm install groq-sdk`
- **Files modified:** package.json, package-lock.json
- **Verification:** TypeScript compiles, `npm run build` succeeds
- **Committed in:** `0e9f8fb` (Task 1 commit)

**2. [Rule 1 - Bug] Groq uses json_object response format instead of zodResponseFormat**
- **Found during:** Task 1 (Implement GroqService)
- **Issue:** groq-sdk has no `helpers/zod` equivalent; zodResponseFormat cannot be used
- **Fix:** Used `response_format: { type: 'json_object' }` with explicit JSON schema in user prompt; parses and validates manually
- **Files modified:** src/app/services/llm/groq-service.ts
- **Verification:** TypeScript compiles cleanly
- **Committed in:** `0e9f8fb` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking dependency, 1 bug/incompatibility)
**Impact on plan:** Both auto-fixes necessary for correctness. No scope creep. Groq validation is functionally equivalent to zodResponseFormat.

## Issues Encountered
None beyond the deviations documented above.

## User Setup Required
Three environment variables must be set for production use:
- `ZAI_API_KEY` — Z.ai API key (primary provider)
- `GROQ_API_KEY` — Groq API key (fallback 1)
- `OPENAI_API_KEY` — OpenAI API key (fallback 2, already required)
- `LLM_PROVIDER` — Optional; defaults to z-ai chain via createWithFallbacks()

## Next Phase Readiness
- Multi-provider LLM foundation complete; ready for Phase 2 (category generation)
- Provider can be tested by setting LLM_PROVIDER=groq or LLM_PROVIDER=openai
- Cost logging visible in server console on every API call

---
*Phase: 01-llm-provider-integration*
*Completed: 2026-02-20*
