# Pitfalls to Roadmap Mapping

**Purpose:** Show how critical pitfalls from PITFALLS.md map to specific roadmap phases and implementation priorities

**Created:** 2026-02-19

---

## Critical Pitfalls → Phase 1 Blockers

These pitfalls are so severe they block the entire project if not fixed in Phase 1:

| Pitfall | Impact | Phase 1 Action | Success Criterion |
|---------|--------|----------------|-------------------|
| **Inconsistent Categorization** | Dashboard reports are unreliable | Generate strict 12-category enum from existing data | Categories are fixed; LLM only accepts enum values |
| **LLM Cost Explosion** | Project becomes unaffordable at scale | Implement provider abstraction layer | Model is configurable; cost tracked per request |
| **Prompt Injection** | User data integrity compromised | Sanitize input; mark user/system boundary in prompt | Injection attempts logged; no category corruption |
| **Silent Data Loss** | Transactions disappear without trace | Read-after-write verification on append | 100% write verification; no silent failures |
| **Duplicate Transactions** | Historical data inflated | Implement deduplication before spreadsheet write | Zero duplicate transactions on test data |

**Risk if deferred:** Building dashboard (Phase 3) on unreliable data with unchecked costs and data loss. Requires complete rework.

---

## Phase 1: Foundation (Week 1)

### "Safety First" Architecture

**Core Goal:** Make the system reliable and cost-effective before adding features.

**Pitfalls Addressed:**

1. **Cost Explosion** → LLM Provider Abstraction
   - Zod validation in service (already done ✓)
   - Environment variable config for model selection (NEW)
   - Cost tracking per request (NEW)
   - Spend limit guard (NEW)

2. **Silent Data Loss** → Robust Error Handling
   - Explicit Google API error code mapping (NEW)
   - Read-after-write verification (NEW)
   - Comprehensive structured logging (NEW)
   - Retry logic with exponential backoff (NEW)

3. **Prompt Injection** → Input Security
   - Sanitize transaction text (NEW)
   - Mark user input boundary in prompt (NEW)
   - Reject injection patterns (NEW)
   - Security logging (NEW)

4. **Duplicate Transactions** → Atomic Writes
   - UUID per transaction request (NEW)
   - Duplicate detection before write (NEW)
   - Atomic write: all or none (NEW)

5. **Input Validation** → API Hardening
   - Length limits: 1-500 characters (NEW)
   - Type validation: string, non-empty (NEW)
   - Reject control characters (NEW)
   - Return 400 Bad Request (NEW)

6. **Rate Limiting** → API Security
   - Per-IP rate limit: 10 req/min (NEW)
   - Per-key quota tracking (NEW)
   - Hard spend limit (NEW)
   - Cost spike alerts (NEW)

**Acceptance Tests:**
- `testProviderAbstraction()`: Switch LLM provider via env var, same output
- `testReadAfterWrite()`: Append + read confirms persistence
- `testInjectionResistance()`: Injection in transaction text doesn't corrupt category
- `testDuplicateDetection()`: Same request twice = 1 entry (not 2)
- `testSpendLimit()`: Block requests when daily limit exceeded
- `testErrorRecovery()`: Google API rate limit (429) triggers retry, succeeds

**Done When:**
- All 6 acceptance tests pass
- Phase 1 PR reviewed; passes security checklist
- Cost per transaction measurable and logged

---

## Phase 2: Data Quality (Week 2)

### "Clean Data" Architecture

**Core Goal:** Ensure category consistency and data integrity before visualization.

**Pitfalls Addressed:**

1. **Inconsistent Categorization** → Category Generation & Validation
   - Script: analyze spreadsheet, extract unique categories (NEW)
   - Deduplication: cluster similar categories (NEW)
   - Generate 12-category enum (NEW)
   - Include enum in LLM prompt (NEW)
   - Validate response against enum (NEW)
   - Reject unknown categories (NEW)

2. **Silent Data Loss** → Spreadsheet Hardening
   - Batch reads: fetch all transactions to verify persistence (NEW)
   - Error code mapping: explicit handling of all Google error types (NEW)
   - Idempotency: same append request never writes twice (NEW)
   - Monitoring: sheet row count vs expected (NEW)

3. **Duplicate Transactions** → Deduplication Layer
   - Check (timestamp ±5min, amount, category) before write (NEW)
   - Store UUID in spreadsheet column (NEW)
   - Log duplicate attempts (NEW)
   - Alert if duplicate rate exceeds threshold (NEW)

4. **Poor Category Design** → Category Validation
   - Audit: 12 categories should cover 95%+ of transactions (NEW)
   - User review: do categories make sense? (MANUAL)
   - Document category definitions (NEW)
   - Test: re-categorize historical data, measure consistency (NEW)

**Acceptance Tests:**
- `testCategoryGeneration()`: Run script, output 12 categories
- `testCategoryValidation()`: LLM returns unknown category, rejected + logged
- `testDeduplicationLogic()`: Identical request within 5 min rejected
- `testSpreadsheetConsistency()`: Append + read confirms row increment
- `testCategoryAccuracy()`: Re-categorize 100 historical txns, measure drift

**Done When:**
- 12 categories generated and validated against 100% of historical data
- All deduplication tests pass
- Category accuracy measured (target: <2% drift on historical re-categorization)
- Zero silent failures on append operations

---

## Phase 3: Visualization (Week 3-4)

### "Trust Me" Dashboard

**Core Goal:** Present accurate data in understandable ways; allow user feedback.

**Pitfalls Addressed:**

1. **Dashboard UX Confusion** → Single Source of Truth
   - All dashboard views query same aggregation API (NEW)
   - Explicit filtering rules documented (NEW)
   - Pie chart: category totals for selected month (NEW)
   - Trend line: rolling 30-day spending (NEW)
   - Data audit button: show raw txns + calculated total (NEW)
   - Test consistency: same query returns same result (NEW)

2. **Timezone Bugs** → Explicit Timezone Handling
   - Store all timestamps as UTC (already done ✓)
   - Add user timezone field (NEW)
   - Dashboard filters: convert local date range to UTC (NEW)
   - Test DST transitions (NEW)
   - Document: "All times UTC, displayed in your timezone" (NEW)

3. **Ambiguous Transactions** → User Correction Loop
   - Dashboard shows recent transactions (NEW)
   - Allow quick category correction (NEW)
   - Store corrections; learn from feedback (NEW)
   - Add LLM confidence score (NEW)
   - Flag low-confidence items for review (NEW)
   - Weekly batch-review interface (NEW)

4. **Data Quality Issues** → Monitoring & Alerts
   - Alert if category distribution changes unexpectedly (NEW)
   - Monitor parsing success rate (NEW)
   - Alert if duplicate rate spikes (NEW)
   - Audit: category totals match spreadsheet (NEW)

**Acceptance Tests:**
- `testDashboardConsistency()`: Pie chart total matches spreadsheet sum
- `testTimezoneHandling()`: Transaction at 11 PM local appears in correct local date
- `testUserCorrection()`: Correct category, verify it's reflected in next API call
- `testLowConfidenceDetection()`: Items with LLM score <0.7 marked for review
- `testDataAuditButton()`: Raw transaction view matches chart calculation

**Done When:**
- Dashboard loads with accurate category totals
- All consistency tests pass
- User can correct 1 category transaction in <5 clicks
- Correction feedback loop works (user corrects → system learns → next similar txn uses correction)

---

## Phase 4: Resilience (Week 5+)

### "Always On" Architecture

**Core Goal:** Handle provider failures gracefully; maintain operation during outages.

**Pitfalls Addressed:**

1. **LLM Provider Outage** → Async Categorization
   - Append transaction immediately with "Pending" category (NEW)
   - Categorize async in background (hourly batch) (NEW)
   - If LLM fails, default to "Uncategorized" (NEW)
   - Fallback API: manual categorization (NEW)
   - Status endpoint: expose LLM health (NEW)

2. **Provider Outage Cascades** → Persistent Job Queue
   - Queue uncategorized transactions (NEW)
   - Retry with exponential backoff (NEW)
   - Monitoring: alert if queue size exceeds threshold (NEW)

3. **Debugging Production Issues** → Logging & Observability
   - Structured logging: Pino or Winston (NEW)
   - Log on every significant operation (NEW)
   - Include request context: txn ID, text, result, error (NEW)
   - Query logs by txn ID (NEW)

4. **Credential Expiration** → Credential Monitoring
   - Check expiration date weekly (NEW)
   - Alert: "Credentials expire in 30 days" (NEW)
   - Implement credential refresh (NEW)

**Acceptance Tests:**
- `testAsyncCategorization()`: Z.ai fails, transaction still saved with "Pending"
- `testBackgroundRetry()`: Pending items batch-reprocessed hourly
- `testStatusEndpoint()`: Report LLM health to Siri Shortcut
- `testLogging()`: Every operation logged; query logs by txn ID
- `testCredentialMonitoring()`: Alert generated 30 days before expiration

**Done When:**
- Provider outage doesn't block expense submission
- User sees "Pending categorization" status, not error
- Background job successfully re-categorizes pending items
- Production incidents can be debugged via logs

---

## Pitfalls to Watch by Phase

### Phase 1 Watch List
- [ ] Cost per request tracked from day 1
- [ ] Spend limit guard prevents surprise bills
- [ ] Append operations verified with read-back
- [ ] Injection attempts don't corrupt categories

### Phase 2 Watch List
- [ ] Category enum has exactly 12 items
- [ ] Duplicate detection doesn't have false positives
- [ ] Category accuracy measured on historical data
- [ ] No transactions lost during migration to Phase 2

### Phase 3 Watch List
- [ ] Dashboard numbers match spreadsheet numbers
- [ ] User corrections actually update database
- [ ] Low-confidence items correctly flagged
- [ ] Timezone transitions don't shift transactions

### Phase 4 Watch List
- [ ] Outages don't prevent expense submission
- [ ] Background reprocessing actually happens
- [ ] Logs are queryable and useful
- [ ] Credentials don't expire unexpectedly

---

## Quality Gates by Phase

### Phase 1 Gate
**Before proceeding to Phase 2:**
- [ ] All safety pitfalls (1-4) have concrete mitigations with tests
- [ ] Cost is measurable and within budget
- [ ] No silent failures on 100 test transactions
- [ ] Code review: security checklist passed

### Phase 2 Gate
**Before proceeding to Phase 3:**
- [ ] Categories are fixed at 12 items; no unknown categories accepted
- [ ] Duplicate rate on historical data: <0.1%
- [ ] Category accuracy on re-categorization: drift <2%
- [ ] Spreadsheet consistency verified on 1000+ transactions

### Phase 3 Gate
**Before launch:**
- [ ] Dashboard totals match spreadsheet 100% of the time
- [ ] User correction UI tested with real users
- [ ] Timezone handling tested across DST transitions
- [ ] Data quality monitoring alerts configured

### Phase 4 Gate
**Before scaling:**
- [ ] Provider outage tested: system continues working
- [ ] Background categorization catches up within 1 hour
- [ ] Logs enable debugging of any production issue
- [ ] No data loss during provider failures

---

## Summary

**Critical Path:** Phase 1 (safety) → Phase 2 (data quality) → Phase 3 (visibility) → Phase 4 (resilience)

**Why this order:**
1. Can't build on unreliable foundation (Phase 1 first)
2. Can't visualize dirty data (Phase 2 before Phase 3)
3. Can optimize after reliability proven (Phase 4 last)

**Pitfall Prevention Strategy:**
- Early mitigation in Phase 1 prevents rework
- Automated tests catch regressions
- Monitoring catches issues in production
- User feedback loop (Phase 3) enables continuous improvement

**Success Metrics:**
- Phase 1: $0 surprise bills; 100% write verification
- Phase 2: 12 consistent categories; <0.1% duplicates
- Phase 3: Dashboard = Spreadsheet; user corrections < 5 clicks
- Phase 4: 99.9% uptime; outages don't cause data loss

---

*Last updated: 2026-02-19*
