# ROADMAP: Track Expenses

**Project:** Personal expense tracking system with cost-effective LLM categorization and visual dashboard
**Depth:** Quick (4 phases, critical path)
**Status:** Draft
**Last updated:** 2026-02-19

## Phases

- [ ] **Phase 1: LLM Provider Integration** - Switch from ChatGPT to Z.ai GLM-4-Flash with provider abstraction and safety controls
- [ ] **Phase 2: Category Generation & Data Quality** - Generate 12 fixed categories from real data and implement quality controls
- [ ] **Phase 3: Analytics API** - Build backend API to expose spending breakdowns by category and time
- [ ] **Phase 4: Frontend Dashboard** - Create React dashboard with pie chart and trend line visualizations

## Phase Details

### Phase 1: LLM Provider Integration

**Goal:** Replace ChatGPT with cost-effective Z.ai GLM-4-Flash while maintaining categorization accuracy and adding safety controls

**Depends on:** None (foundation phase)

**Requirements:** LLM-01, LLM-02, LLM-03, LLM-04, LLM-05, LLM-06, LLM-07

**Success Criteria** (what must be TRUE when complete):
1. User sends expense via Siri Shortcut and system categorizes it using Z.ai instead of ChatGPT (LLM-01)
2. User can switch LLM providers by changing environment variables without code modifications (LLM-02)
3. System automatically falls back to Deepseek-V3 when Z.ai is unavailable, with no user intervention required (LLM-03)
4. System consistently categorizes transactions into exactly the 12 defined categories, rejecting any other category values (LLM-04)
5. Maliciously crafted transaction text (prompt injection attempts) does not cause the LLM to return unexpected categories (LLM-05)
6. When Z.ai API fails, the system logs the error and verifies the response was not partially persisted to Google Sheets (LLM-06)
7. System operators can monitor total API spend per transaction and identify if costs exceed budget threshold (LLM-07)

**Plans:** 2 plans

Plans:
- [ ] 01-01-PLAN.md — Z.ai + Deepseek provider services, FallbackLLMService, factory env var routing, input sanitization, cost monitoring
- [ ] 01-02-PLAN.md — 12-category enum enforcement in Zod schema, hardened system prompts, read-after-write verification, env config + human verify

---

### Phase 2: Category Generation & Data Quality

**Goal:** Derive 12 representative expense categories from existing transaction history and prevent data quality issues

**Depends on:** Phase 1 (LLM provider must be stable to reliably categorize historical data)

**Requirements:** CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06

**Success Criteria** (what must be TRUE when complete):
1. User runs category generation script and gets 12 representative categories extracted from their existing Google Sheets transactions (CAT-01)
2. System uses these 12 categories in the LLM system prompt and rejects categorization attempts that suggest any other category (CAT-02, CAT-03)
3. When user submits the same expense twice (detected via request UUID), the second submission is rejected or merged with the first, preventing duplicate charges (CAT-04)
4. System rejects transactions with unknown/invalid categories and logs which transaction failed categorization (CAT-05)
5. Transactions that fail LLM categorization are marked "Uncategorized" in Google Sheets instead of being silently dropped from the system (CAT-06)

**Plans:** TBD

---

### Phase 3: Analytics API

**Goal:** Build backend API that transforms Google Sheets transaction data into category and time-based spending breakdowns

**Depends on:** Phase 1 (needs stable LLM), Phase 2 (needs final category set)

**Requirements:** API-01, API-02, API-03, API-04, API-05, API-06, API-07

**Success Criteria** (what must be TRUE when complete):
1. User calls GET `/api/analytics` and receives JSON showing total spending amount and percentage for each category (pie chart data) (API-01, API-05)
2. User can add `?month=2026-02` to the API call and see only expenses from that month (API-02)
3. User can add `?months=6` to the API call and receive spending totals for the last 6 months, enabling trend visualization (API-03)
4. User verifies that the total spending in the API response matches the sum of all transactions in Google Sheets for the requested time period (API-04)
5. System correctly handles month boundaries even when expenses span timezone changes (DST transitions do not cause data loss or duplication) (API-06)
6. If the API encounters an error (bad query param, Google Sheets connection failure), it returns a meaningful error message and sensible fallback values instead of crashing (API-07)

**Plans:** TBD

---

### Phase 4: Frontend Dashboard

**Goal:** Provide visual, interactive interface for users to explore spending patterns by category and over time

**Depends on:** Phase 3 (dashboard consumes `/api/analytics` endpoint)

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07

**Success Criteria** (what must be TRUE when complete):
1. User opens the dashboard and immediately sees a pie chart showing their current month's spending broken down by category (DASH-01)
2. User can select a different month using a dropdown or calendar picker and the pie chart updates to show that month's data (DASH-02)
3. Dashboard displays a trend line chart showing total spending for each of the last 3-12 months (DASH-03)
4. User can adjust the number of months displayed in the trend line (configurable from 3 to 12) and chart updates in real-time (DASH-04)
5. Dashboard clearly labels what data is being shown (chart titles, axis labels, category legend) so the user understands the visualization without external documentation (DASH-05)
6. Dashboard successfully retrieves data from the `/api/analytics` endpoint and renders real expense data from Google Sheets (DASH-06)
7. When the API is slow or unavailable, the dashboard shows a loading indicator or helpful error message instead of appearing broken (DASH-07)

**Plans:** TBD

---

## Cross-Cutting Requirements

The following requirements apply throughout all phases and are validated continuously:

- **SYS-01:** All expense data continues to be stored in Google Sheets (no database migration)
- **SYS-02:** Siri Shortcut integration continues to work unchanged (backward compatible with existing flow)
- **SYS-03:** All changes are committed to git with clear, descriptive commit messages

## Progress Tracking

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. LLM Provider Integration | 0/2 | Planned | — |
| 2. Category Generation & Data Quality | 0/TBD | Not started | — |
| 3. Analytics API | 0/TBD | Not started | — |
| 4. Frontend Dashboard | 0/TBD | Not started | — |

## Coverage Summary

- **Total v1 requirements:** 30
- **Mapped to phases:** 27 (LLM-01 through DASH-07, CAT-01 through CAT-06)
- **System-wide requirements:** 3 (SYS-01, SYS-02, SYS-03)
- **Coverage:** 100% ✓

---

*Roadmap created: 2026-02-19*
*Phase 1 planned: 2026-02-19 — 2 plans, 2 waves*
