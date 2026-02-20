# ROADMAP: Track Expenses

**Project:** Personal expense tracking system with cost-effective LLM categorization and visual dashboard
**Depth:** Quick (4 phases, critical path)
**Status:** In Progress (v1.0 shipped, v1.1 planning)
**Last updated:** 2026-02-20

## Milestones

- ✅ **v1.0 Foundation** — Phases 1-2 (shipped 2026-02-20)
- 🚧 **v1.1 Analytics & Dashboard** — Phases 3-4 (planned)

## Phases

<details open>
<summary>✅ v1.0 Foundation (Phases 1-2) — SHIPPED 2026-02-20</summary>

- [x] Phase 1: LLM Provider Integration (2/2 plans) — completed 2026-02-20
- [x] Phase 2: Category Generation & Data Quality (2/2 plans) — completed 2026-02-20

**Shipped:** Multi-provider LLM architecture (Z.ai/Groq/OpenAI), 12-category enum enforcement, UUID dedup, recoverable parse failures.

See `.planning/milestones/v1.0-ROADMAP.md` for detailed phase breakdown.

</details>

## Phase Details (v1.1+)

### Phase 3: Analytics API

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

| Milestone | Phase | Plans Complete | Status | Completed |
|-----------|-------|----------------|--------|-----------|
| v1.0 | 1. LLM Provider Integration | 2/2 | Complete   | 2026-02-20 |
| v1.0 | 2. Category Generation & Data Quality | 2/2 | Complete   | 2026-02-20 |
| v1.1 | 3. Analytics API | 0/TBD | Not started | — |
| v1.1 | 4. Frontend Dashboard | 0/TBD | Not started | — |

## Coverage Summary

- **Total v1 requirements:** 30
- **Mapped to phases:** 27 (LLM-01 through DASH-07, CAT-01 through CAT-06)
- **System-wide requirements:** 3 (SYS-01, SYS-02, SYS-03)
- **Coverage:** 100% ✓

---

*Roadmap created: 2026-02-19*
*Phase 1 planned: 2026-02-19 — 2 plans, 2 waves*
*Phase 2 planned: 2026-02-20 — 2 plans, 2 waves*
