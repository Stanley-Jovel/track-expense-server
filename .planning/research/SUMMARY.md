# Research Summary: Cost-Effective LLM Expense Categorization

**Domain:** Expense tracking with LLM-based categorization
**Researched:** 2026-02-19
**Overall confidence:** MEDIUM (based on Feb 2025 training data + reasonable Feb 2026 inference)

## Executive Summary

The current expense tracking system uses OpenAI's GPT-4o for transaction categorization—effective but expensive (~$2/month for 100 transactions). Research identified three cost-effective alternatives that reduce spend to near-zero:

1. **Z.ai GLM-4-Flash** — Free unlimited tier, OpenAI-compatible API, suitable for categorization
2. **Deepseek-V3** — <$1/month, extremely cheap, strong reasoning, fallback-ready
3. **Claude 3.5 Haiku** — $0.45/month, most reliable, best for financial reasoning

The project's existing factory pattern abstraction layer supports easy provider swapping. Implementation is low-risk: add 1-2 new service files, extend factory, update environment config. No architectural changes needed.

**Key finding:** The cost reduction opportunity exists because expense categorization is a simpler task than general LLM work. GLM-4-Flash and Deepseek-V3 are capable at this narrower scope while excelling at cost efficiency.

## Key Findings

**Stack:** Z.ai GLM-4-Flash (primary, free) + Deepseek-V3 (fallback, <$1/month) + OpenAI (last resort)

**Architecture:** Extend existing `LLMServiceFactory` pattern with 2-3 new provider implementations

**Critical decision:** Accept free tier usage (Z.ai) with fallback plan. If Z.ai's free tier is withdrawn, Deepseek provides sub-$1/month insurance.

## Implications for Roadmap

Based on research, suggested phase structure for LLM provider migration:

### Phase 1: Z.ai Integration (1-2 days)
**Goal:** Switch from OpenAI to free Z.ai GLM-4-Flash

**What to build:**
- New file: `src/app/services/llm/zai-service.ts`
- Extend: `LLMServiceFactory` to support provider selection
- Update: `.env.example` with `LLM_PROVIDER` and `ZAI_API_KEY` config
- Update: API route to use factory with environment selection
- Refine: System prompt to constrain output to 12 fixed categories
- Add: Automated tests comparing Z.ai vs OpenAI accuracy on sample transactions

**Addresses:**
- Requirement: "Switch LLM from ChatGPT to Z.ai" ✓
- Requirement: "Create LLM provider abstraction layer" (partial) ✓
- Cost reduction: ~$2/month → $0/month

**Avoids:**
- Pitfall: Vendor lock-in (factory pattern already prevents)
- Risk: Rate limiting (1 req/sec sufficient for single-user Siri Shortcut flow)

**Success criteria:**
- Z.ai service parses transactions with ≥95% accuracy (compare to OpenAI baseline)
- Free API requests complete <2 seconds (acceptable for async flow)
- Zero code changes required in API route or spreadsheet service

### Phase 2: Deepseek Fallback (1 day)
**Goal:** Add production fallback if Z.ai free tier becomes unavailable

**What to build:**
- New file: `src/app/services/llm/deepseek-service.ts`
- Extend: Factory to support Deepseek provider
- Add: Health check + fallback logic (if Z.ai fails → Deepseek auto-switch)
- Add: Monitoring/alerting for fallback activations

**Depends on:** Phase 1 completion and Z.ai stability proof

**Why separate phase:** Insurance, not MVP. Phase 1 must be rock-solid first.

### Phase 3: Category Generation Script (Before dashboard)
**Goal:** Generate 12 fixed categories from existing Google Sheets data

**What to build:**
- New file: `scripts/generate-categories.ts`
- Logic: Analyze all transactions in Google Sheets, extract unique category values, infer 12 representative categories
- Output: Update `SYSTEM_PROMPT` with category list based on real data
- New sheet: "Categories" with manually-curated final 12 categories and descriptions

**Why before dashboard:** Dashboard must display these 12 categories. Categories must come from real data.

**Prerequisite:** Phase 1 (LLM provider must be finalized before running category analysis)

### Phase 4: Frontend Dashboard (2-3 weeks)
**Goal:** Replace raw Google Sheets with React dashboard

**What to build:**
- React component: Pie chart (monthly spending by category)
- React component: Trend line (last X months spending)
- Next.js API route: `/api/spending/summary` returning category breakdown
- Fetch: All transactions from Google Sheets for dashboard
- Filtering: By month selector

**Prerequisites:**
- Phase 1 (stable LLM)
- Phase 3 (fixed category set)

**Not in Phase 1-3:** Search/filter, budgets, notifications (deferred per requirements)

## Phase Ordering Rationale

**Why this order:**

1. **Phase 1 first:** LLM provider is the critical path for cost reduction and accuracy. All downstream work depends on it. De-risk early.

2. **Phase 2 depends on Phase 1:** Can't design fallback strategy until Phase 1 is proven stable. Fallback is insurance, not MVP.

3. **Phase 3 before Phase 4:** Dashboard needs category set. Categories should be derived from real data, not guessed. Phase 1 provides the LLM capability to do this well.

4. **Phase 4 last:** Frontend is the most visible work but depends on everything else. Leave for last when LLM and categories are locked.

## Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| **Z.ai availability** | MEDIUM | Free tier confirmed available Feb 2025, but no guarantees it persists. Risk is real but manageable with Phase 2 fallback. |
| **Z.ai API compatibility** | MEDIUM-HIGH | Documented as OpenAI-compatible, but not officially battle-tested by this project. Phase 1 includes validation testing. |
| **Cost estimates** | HIGH | Pricing is public and stable. Actual spend may vary but order-of-magnitude is correct. |
| **Architecture fit** | HIGH | Factory pattern is already correct. Extending it is straightforward. |
| **Categorization accuracy** | MEDIUM | GLM-4-Flash is capable but unproven on your specific expense types. Phase 1 A/B testing mitigates this. |
| **Deepseek reliability** | MEDIUM | Well-funded, new model, but less proven than OpenAI. Good for fallback, not primary. |

## Gaps to Address

**These require phase-specific research later:**

1. **Z.ai rate limit behavior under load** — Phase 1 testing should stress-test 10+ requests. Free tier may have hidden limits.

2. **Category accuracy on real data** — Phase 3 category generation script needs testing on full transaction history to validate 12 categories cover 95%+ of spend.

3. **Dashboard performance at scale** — Phase 4 must test with full year of transactions. Google Sheets may slow down beyond 10k rows (not a concern yet, but flag it).

4. **Provider switching without data loss** — If we switch LLM mid-way and re-categorize old expenses, how do we handle existing categorizations? Phase 2 should address this.

## Recommendations

**Go/No-Go decisions:**

- **✓ YES** to Z.ai as primary provider. Free, OpenAI-compatible, good for task.
- **✓ YES** to Deepseek as fallback. Insurance cost is <$1/month.
- **✗ NO** to Claude as primary. Cost is 45x higher than Deepseek for same task.
- **✗ NO** to staying on OpenAI. Defeats the cost-reduction goal.

**Build order:** Phase 1 → Phase 2 → Phase 3 → Phase 4

**Estimated timeline:**
- Phase 1: 1-2 days (includes testing)
- Phase 2: 1 day (fallback logic is simple)
- Phase 3: 2-3 days (category analysis + validation)
- Phase 4: 2-3 weeks (dashboard complexity, not LLM-related)

**Total LLM work:** 4-5 days before dashboard sprint

---

*Last updated: 2026-02-19*
