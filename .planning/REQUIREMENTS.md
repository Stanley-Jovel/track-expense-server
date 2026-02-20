# Requirements: Track Expenses

**Defined:** 2026-02-19
**Core Value:** Low-cost expense tracking with accurate, predictable categorization and clear visibility into where money goes

## v1 Requirements

### LLM Provider Integration (Phase 1)

- [ ] **LLM-01**: System uses Z.ai GLM-4-Flash API for expense categorization instead of ChatGPT
- [ ] **LLM-02**: LLM API provider is abstracted (swap providers by changing config/env variables)
- [ ] **LLM-03**: Deepseek-V3 is available as fallback provider when Z.ai is unavailable
- [ ] **LJM-04**: System prompt enforces categorization into fixed 12-category enum (rejects other categories)
- [ ] **LLM-05**: Input sanitization prevents prompt injection attacks via transaction text
- [ ] **LLM-06**: API failures include proper error handling with read-after-write verification
- [ ] **LLM-07**: Cost monitoring tracks API spend per transaction (alerts if exceeds budget)

### Category Generation & Data Quality (Phase 2)

- [ ] **CAT-01**: Script analyzes existing Google Sheets transactions and suggests 12 representative categories
- [ ] **CAT-02**: System uses generated categories in fixed enum (prevents random category selection)
- [ ] **CAT-03**: Category enum is stored in system prompt and applied to all categorization requests
- [ ] **CAT-04**: Duplicate transaction detection prevents same expense logged twice (per request UUID)
- [ ] **CAT-05**: Category validation rejects unknown categories and logs mismatches
- [ ] **CAT-06**: Transactions that fail categorization are marked "Uncategorized" instead of silently failing

### Analytics API (Phase 3)

- [ ] **API-01**: GET `/api/analytics` returns monthly spending breakdown by category (pie chart data)
- [ ] **API-02**: GET `/api/analytics` accepts `month` query parameter to filter by specific month (default: current month)
- [ ] **API-03**: GET `/api/analytics` accepts `months` query parameter to return trend data for last X months
- [ ] **API-04**: Analytics data totals match Google Sheets 100% (verified per response)
- [ ] **API-05**: Response format is JSON with category names, amounts, and percentages
- [ ] **API-06**: API handles timezone correctly (no DST transition bugs)
- [ ] **API-07**: API error responses include meaningful error messages and fallback values

### Frontend Dashboard (Phase 4)

- [ ] **DASH-01**: React dashboard displays pie chart of current month's spending by category
- [ ] **DASH-02**: Dashboard pie chart is filterable by month (dropdown or calendar picker)
- [ ] **DASH-03**: Dashboard displays trend line showing last X months of total spending
- [ ] **DASH-04**: Trend line months count is configurable (user can adjust from 3 to 12 months)
- [ ] **DASH-05**: Dashboard title and legend clearly label what data is being shown
- [ ] **DASH-06**: Dashboard connects to `/api/analytics` endpoint and displays real data
- [ ] **DASH-07**: Loading states and error messages inform user when data is unavailable

### System-Wide (All Phases)

- [ ] **SYS-01**: All expense data continues to be stored in Google Sheets (no database migration)
- [ ] **SYS-02**: Siri Shortcut integration continues to work unchanged (backward compatible)
- [ ] **SYS-03**: All changes are committed to git with clear commit messages

## v2 Requirements

### Enhanced Analytics

- **DASH-08**: Category heatmap (calendar view of daily spending)
- **DASH-09**: Anomaly detection (alerts for unusual spending)
- **DASH-10**: Budget vs actual visualization with spending limits per category

### User Corrections & Learning

- **DATA-01**: User can manually correct miscategorized transaction
- **DATA-02**: System learns from corrections (track feedback for model improvement)

### Integrations & Scale

- **SCALE-01**: Real-time notifications for significant spending
- **SCALE-02**: Mobile app (currently web-only)
- **SCALE-03**: Database migration evaluation (Google Sheets → PostgreSQL at 10K+ transactions)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Search/filter by individual transactions | Low priority; pie charts + trends cover MVP need |
| Budget tracking/spending limits | Defer to v2; focus on visualization first |
| Recurring expense detection | Requires more sophisticated analysis; v2+ |
| Multi-currency support | Not needed for personal use |
| OAuth login / Auth | Personal app for single user; simple API key sufficient |
| Mobile app | Web dashboard sufficient for v1; mobile is v2+ |
| Real-time expense sync | Async via Siri Shortcut is fine; real-time not needed |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| LLM-01 | Phase 1 | Pending |
| LLM-02 | Phase 1 | Pending |
| LLM-03 | Phase 1 | Pending |
| LLM-04 | Phase 1 | Pending |
| LLM-05 | Phase 1 | Pending |
| LLM-06 | Phase 1 | Pending |
| LLM-07 | Phase 1 | Pending |
| CAT-01 | Phase 2 | Pending |
| CAT-02 | Phase 2 | Pending |
| CAT-03 | Phase 2 | Pending |
| CAT-04 | Phase 2 | Pending |
| CAT-05 | Phase 2 | Pending |
| CAT-06 | Phase 2 | Pending |
| API-01 | Phase 3 | Pending |
| API-02 | Phase 3 | Pending |
| API-03 | Phase 3 | Pending |
| API-04 | Phase 3 | Pending |
| API-05 | Phase 3 | Pending |
| API-06 | Phase 3 | Pending |
| API-07 | Phase 3 | Pending |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DASH-05 | Phase 4 | Pending |
| DASH-06 | Phase 4 | Pending |
| DASH-07 | Phase 4 | Pending |
| SYS-01 | All Phases | Pending |
| SYS-02 | All Phases | Pending |
| SYS-03 | All Phases | Pending |

**Coverage:**
- v1 requirements: 30 total
- Mapped to phases: 30
- Unmapped: 0 ✓

---
*Requirements defined: 2026-02-19*
*Last updated: 2026-02-19 after research completion*
