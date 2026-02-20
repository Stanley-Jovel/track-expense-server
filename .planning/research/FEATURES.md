# Feature Landscape: LLM Expense Categorization

**Domain:** Expense categorization with cost-effective LLM providers
**Researched:** 2026-02-19

## Table Stakes

Features users expect. Missing = broken categorization.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Single transaction parsing** | Core requirement; Siri Shortcut sends 1-3 transactions at a time | Low | Existing implementation via `parseTransaction()` |
| **Multiple transaction batching** | User may say "Starbucks $5, lunch $12, Target $45" in one message | Low | Already implemented in OpenAI service |
| **Structured output (JSON)** | Spreadsheet integration requires structured data; not freeform text | Low | Uses Zod schema validation |
| **Category assignment** | Every expense must have a category (required field) | Low | Enforced by schema |
| **Amount preservation** | Must parse numeric amount accurately; cannot hallucinate prices | Medium | Critical for spreadsheet accuracy |
| **Amount type detection** | Must distinguish Income vs Expense | Low | Enum in schema validates this |
| **Consistent categorization** | Same transaction type → same category (e.g., Starbucks always "Dining") | Medium | LLM behavior, test with fallback providers |
| **Reasonable latency** | Async flow allows 2-3 second response; faster is better | Low | Z.ai/Deepseek both adequate |
| **Error handling** | Invalid input (nonsense text) must be rejected with clear error | Low | Schema validation + explicit error type |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Provider abstraction** | Swap LLM without code changes; avoids vendor lock-in | Medium | Factory pattern already exists; extend it |
| **Multi-provider fallback** | If primary LLM fails, automatically try secondary | Medium | Simple fallback logic; needs monitoring |
| **Cost transparency** | Show user how much LLM API call cost (optional feature) | Low | Add to response metadata if needed later |
| **Category confidence score** | LLM returns confidence (0.0-1.0) for categorization | Low-Medium | Not MVP but easy to add with structured output |
| **Custom category set** | User can define own 12 categories instead of hardcoded | Medium | Phase 3+ feature; requires UI |
| **Categorization audit trail** | Log why LLM chose specific category (reasoning) | Low | Use LLM "thinking" field if available; phase 2+ |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multiple LLM calls per transaction** | Cost multiplier; overcomplicated | Single call with structured output (current approach) |
| **Fine-tuning/custom models** | Expensive, slow to iterate, vendor-specific | Use high-quality prompting + fallback providers |
| **Real-time categorization streaming** | Unnecessary for async flow; adds complexity | Keep batch processing |
| **LLM-powered budget recommendations** | Out of scope for MVP; deferred to v2 | Focus on accurate categorization only |
| **Multi-language support** | Adds complexity; Siri Shortcut is English-only | Assume English-only input |
| **Semantic search on expenses** | Requires embeddings; adds database and cost | Simple filtering/sorting sufficient for MVP |

## Feature Dependencies

```
Core MVP:
  Transaction Parsing → Category Assignment → Spreadsheet Write

Phase 1 (LLM migration):
  Provider Abstraction → Z.ai Service → Factory Extension

Phase 2 (Fallback):
  Z.ai Service → Deepseek Service → Fallback Logic

Phase 3 (Category generation):
  Spreadsheet Read All Transactions → Category Analysis → Fixed 12-Category Set

Phase 4 (Dashboard):
  Fixed 12-Category Set + Monthly Aggregation → Pie Chart + Trend Line
```

## LLM Feature Requirements

### Input Features
- Accept plain English transaction description (e.g., "Starbucks coffee $5.50")
- Support 1-3 transactions in single request (comma-separated)
- Support optional metadata (date, merchant, raw amount)
- Reject empty or nonsensical input gracefully

### Output Features
- Return structured JSON with category, amount, type, description
- Categories must be from fixed set of 12 (Phase 3)
- Amounts must be numeric (no string formatting)
- Type must be "Income" or "Expense" only

### Behavior Features
- Consistent categorization (same input → same output)
- Reasonable temperature/sampling (low randomness; high precision)
- Fast inference (< 3 seconds for 3 transactions)
- Graceful error messages for invalid requests

### Non-Functional Requirements
- Cost: < $1/month for typical usage
- Reliability: >99% uptime (standard SaaS)
- Latency: <2 seconds p99 per transaction
- Support: Documented API, community help available

## MVP Feature Set

### What's IN
1. Transaction parsing with category assignment
2. Multiple transactions per request
3. Structured JSON output with Zod validation
4. Z.ai as primary provider (Phase 1)
5. Fallback error handling (Phase 1)
6. Environment-based provider selection (Phase 1)

### What's OUT (Deferred)
- Deepseek fallback logic (Phase 2)
- Category confidence scores (Phase 2+)
- Reasoning/audit trails (Phase 2+)
- Custom category support (Phase 3+)
- Cost tracking/transparency (Phase 4+)

## Success Metrics

| Metric | Target | How to Measure |
|--------|--------|-----------------|
| **Categorization accuracy** | ≥95% match to user intent | A/B test Z.ai vs OpenAI on 100 test transactions |
| **Cost per categorization** | <$0.001 per transaction (Z.ai free tier) | Monitor API usage logs |
| **Response time** | <2 seconds p99 | Log request timestamps, monitor latency |
| **Provider fallback activation** | <1% (should be rare) | Alert if fallback switches occur |
| **Schema validation pass rate** | 100% (all responses parseable) | Test error rate on invalid inputs |

## Testing Strategy

### Unit Tests
- Service initialization with each provider
- Correct schema validation
- Error handling for invalid inputs
- Provider factory selection logic

### Integration Tests
- End-to-end parsing: raw transaction → spreadsheet write
- Fallback activation: simulate Z.ai timeout → expect Deepseek call
- Rate limiting: send 5+ requests quickly → expect queue/backoff

### Accuracy Tests
- Test set of 50 transaction descriptions
- Compare Z.ai, Deepseek, OpenAI categorizations
- Flag mismatches for review
- Track confidence by transaction type

### Load Tests
- 10 concurrent requests
- Verify rate limiting doesn't crash service
- Monitor memory usage

## Phased Rollout

### Phase 1: Z.ai MVP
- Z.ai service + factory extension
- Environment-based provider selection
- A/B testing for accuracy
- Acceptance: accuracy ≥95% on test set

### Phase 2: Deepseek Fallback
- Deepseek service implementation
- Automatic fallback on Z.ai failure
- Monitoring/alerting
- Acceptance: fallback works on demand test

### Phase 3+: Polish
- Category confidence scores
- Audit trails / reasoning
- Custom categories
- Cost transparency

---

*Last updated: 2026-02-19*
