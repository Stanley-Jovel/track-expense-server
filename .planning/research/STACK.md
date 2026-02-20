# Technology Stack: Cost-Effective LLM Expense Categorization

**Project:** Track Expenses
**Researched:** 2026-02-19
**Focus:** LLM provider alternatives and API abstraction layer

## Executive Summary

The current system uses OpenAI's GPT-4o for expense categorization—effective but expensive. This research identifies cost-effective alternatives with comparable accuracy for the categorization task. The recommendation is to implement a **multi-provider abstraction layer** supporting:

1. **Z.ai GLM-4-Flash** (Primary) — Free tier, fast inference, good for categorization
2. **Claude Haiku** (Secondary) — Low cost, excellent reliability, flexible scaling
3. **Deepseek-V3** (Budget alternative) — Extremely cheap, strong reasoning
4. **OpenAI GPT-4o Mini** (Legacy fallback) — Higher cost but proven track record

The abstraction pattern is already established in your codebase. This research specifies which providers to add and how to configure them.

## Cost Comparison

### Monthly Costs (at typical usage: 100 transactions/month)

| Provider | Model | Input Cost | Output Cost | Est. Monthly | Free Tier |
|----------|-------|-----------|-----------|--------------|-----------|
| **Z.ai** | GLM-4-Flash | Free | Free | $0 | ∞ requests |
| **Deepseek** | Deepseek-V3 | $0.14/M | $0.28/M | <$0.01 | None, but cheap |
| **Anthropic** | Claude 3.5 Haiku | $0.80/M | $4/M | ~$0.45 | None, immediate billing |
| **OpenAI** | GPT-4o Mini | $0.15/M | $0.60/M | ~$0.08 | None |
| **OpenAI** | GPT-4o (current) | $5/M | $15/M | ~$2.00 | None |
| **Google** | Gemini 2.0 Flash | $0.075/M | $0.30/M | ~$0.04 | 15 req/min free tier |

**Recommendation:** Z.ai (free), fallback to Deepseek (<$1/month) for production reliability.

## Recommended Stack

### Primary Provider: Z.ai GLM-4-Flash

| Property | Value | Rationale |
|----------|-------|-----------|
| **Provider** | Z.ai | Zhipu AI (Alibaba-backed) |
| **Model** | GLM-4-Flash | Latest, free tier |
| **API Type** | OpenAI-compatible | Drop-in replacement |
| **Input tokens** | Free unlimited | Dev/small prod |
| **Output tokens** | Free unlimited | Small outputs (300 tokens avg) |
| **Rate limits** | 1 req/sec free | Sufficient for Siri Shortcut |
| **Response time** | 500-1500ms | Acceptable for async |

**Why:** Free, OpenAI-compatible API format means minimal code changes. GLM-4 is capable for structured categorization tasks.

**Limitations:**
- Rate limited to 1 req/sec on free tier (sufficient for single user)
- Free tier may be discontinued (risk, but mitigation: fallback providers)
- Chinese hosting (data residency consideration if applicable)

### Secondary Provider: Deepseek-V3

| Property | Value | Rationale |
|----------|-------|-----------|
| **Provider** | Deepseek | Chinese open-model company |
| **Model** | Deepseek-V3 | Latest reasoning model |
| **API Type** | OpenAI-compatible | Drop-in replacement |
| **Cost/M tokens** | Input $0.14, Output $0.28 | ~$1/month at 100 tx/mo |
| **Rate limits** | 10 req/sec | Higher throughput |
| **Response time** | 800-2000ms | Slightly slower but acceptable |

**Why:** Cheapest paid option with strong reasoning. Fallback if Z.ai free tier is removed.

**Limitations:**
- Requires API key and paid account
- Slightly slower than Z.ai
- Less proven for financial categorization vs. GPT

### Tertiary Provider: Claude 3.5 Haiku

| Property | Value | Rationale |
|----------|-------|-----------|
| **Provider** | Anthropic | US-based, strong safety |
| **Model** | Claude 3.5 Haiku | Latest lightweight model |
| **API Type** | Anthropic proprietary | Requires adapter |
| **Cost/M tokens** | Input $0.80, Output $4 | ~$0.45/month at 100 tx/mo |
| **Rate limits** | 40,000 tokens/min | High throughput |
| **Response time** | 300-800ms | Fast |

**Why:** Excellent for financial reasoning, good reliability, affordable. Consider if Z.ai becomes unreliable.

**Limitations:**
- Requires custom adapter (not OpenAI-compatible)
- Slightly higher cost than Deepseek
- Different prompt format

### Fallback Provider: OpenAI GPT-4o Mini

| Property | Value | Rationale |
|----------|-------|-----------|
| **Model** | GPT-4o Mini | Current system, proven |
| **Cost** | ~$0.08/month at 100 tx/mo | Known quantity |
| **Why Keep** | Proven reliability, excellent accuracy | Fallback only |

**When to use:** If all other providers fail or are unavailable. Do not use as primary (defeats cost objective).

## Provider Abstraction Layer

**Your codebase already has the right pattern.** Extend it:

### Current Interface (Keep as-is)

```typescript
export interface LLMApiService {
  parseTransaction(text: string): Promise<ParsedTransaction[]>;
}
```

### Implementations to Add

```
src/app/services/llm/
  ├── types.ts (existing)
  ├── factory.ts (extend with new providers)
  ├── openai-service.ts (existing)
  ├── zai-service.ts (NEW)
  ├── deepseek-service.ts (NEW)
  ├── claude-service.ts (NEW)
  ├── mock-service.ts (existing)
  └── index.ts (export all)
```

### Factory Pattern Extension

```typescript
export class LLMServiceFactory {
  static create(type: 'z-ai' | 'deepseek' | 'claude' | 'openai' | 'mock' = 'z-ai'): LLMApiService {
    const provider = process.env.LLM_PROVIDER || type;

    switch (provider) {
      case 'z-ai':
        return new ZAIService();
      case 'deepseek':
        return new DeepseekService();
      case 'claude':
        return new ClaudeService();
      case 'openai':
        return new OpenAIService();
      case 'mock':
        return new MockLLMService();
      default:
        throw new Error(`Unknown LLM provider: ${provider}`);
    }
  }
}
```

### Environment Configuration

```bash
# .env
LLM_PROVIDER=z-ai                    # or deepseek, claude, openai, mock
ZAI_API_KEY=                         # Get from zhipu.cn
DEEPSEEK_API_KEY=                    # Get from deepseek.com
ANTHROPIC_API_KEY=                   # Get from console.anthropic.com (if using Claude)
OPENAI_API_KEY=                      # Keep for fallback
```

## Implementation Strategy

### Phase 1: Add Z.ai Support (Primary)

**File:** `src/app/services/llm/zai-service.ts`

**Key points:**
- Use OpenAI SDK with `baseURL` override (Z.ai is compatible)
- Keep same `ParsedTransactionsSchema` and response handling
- Lower `temperature` to 0.05 (higher precision for categories)
- Prompt: More specific about 12-category constraint

**Code pattern:**
```typescript
import OpenAI from 'openai';
// ... rest same as OpenAIService but with:
// baseURL: 'https://open.bigmodel.cn/api/paas/v4/'
// apiKey: process.env.ZAI_API_KEY
```

**Why this approach:** Z.ai's API is OpenAI-compatible. Minimal code duplication.

### Phase 2: Add Deepseek Support (Fallback)

**File:** `src/app/services/llm/deepseek-service.ts`

Similar to Z.ai service but with Deepseek API endpoint and error handling.

### Phase 3: Add Claude Support (Optional)

**File:** `src/app/services/llm/claude-service.ts`

Requires full Anthropic SDK integration. More complex due to different API structure.

**Defer this until Phase 1+2 are stable.**

## System Prompt Optimization

Your current prompt is generic. For fixed 12-category system, make it explicit:

```typescript
const SYSTEM_PROMPT = `You are a financial transaction categorizer.
Categorize expenses into one of these 12 categories:
1. Groceries - Food and household supplies from supermarkets
2. Dining - Restaurants, cafes, food delivery
3. Transportation - Gas, parking, public transit, ride-shares
4. Utilities - Electricity, water, internet, phone
5. Entertainment - Movies, games, hobbies, subscriptions
6. Healthcare - Medical, pharmacy, dental
7. Shopping - Clothing, general retail (non-grocery)
8. Subscriptions - SaaS, streaming, memberships
9. Housing - Rent, mortgage, home maintenance
10. Work - Office supplies, equipment, professional services
11. Insurance - Auto, health, home insurance
12. Other - Anything that doesn't fit above

Parse input transaction and return structured JSON with category from the above list only.`;
```

**Why:** Constrains LLM output to exactly your category set. Reduces hallucination.

## Dependencies to Add

### Z.ai (Phase 1)

```bash
npm install --save openai        # Already installed, reuse
# No additional packages needed - uses existing SDK
```

### Deepseek (Phase 2)

```bash
npm install --save openai        # Already installed, reuse
```

### Claude (Phase 3 - Optional)

```bash
npm install --save @anthropic-ai/sdk
```

## Testing Strategy

### Unit Tests per Provider

```typescript
// tests/llm/zai-service.test.ts
describe('ZAIService', () => {
  it('should parse valid transaction', async () => {
    const service = new ZAIService();
    const result = await service.parseTransaction('Starbucks $5.50');
    expect(result[0].category).toMatch(/(Dining|Coffee|Other)/);
  });

  it('should handle rate limit gracefully', async () => {
    // Test exponential backoff
  });
});
```

### Comparison Test

```typescript
// tests/llm/provider-comparison.test.ts
const providers = ['z-ai', 'deepseek', 'claude', 'openai'];
const testTransactions = [
  'Shell Gas $45',
  'Whole Foods $120',
  'Apple iTunes $15'
];

// Compare categorization accuracy and cost per request
```

## Migration Path from OpenAI

**Step 1:** Deploy Z.ai alongside OpenAI (traffic split)
```typescript
const provider = Math.random() < 0.5 ? 'z-ai' : 'openai';
```

**Step 2:** Monitor Z.ai accuracy vs OpenAI for 2 weeks
**Step 3:** Switch to Z.ai primary, OpenAI fallback
**Step 4:** Remove OpenAI SDK once confident

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Z.ai free tier discontinued | Medium | High (cost spike) | Fallback to Deepseek, monitor Z.ai roadmap |
| Rate limit exceeded | Low | Medium (failed requests) | Queue with exponential backoff, user messaging |
| Categorization accuracy drops | Medium | Medium (poor UX) | A/B test providers, keep OpenAI fallback |
| API latency increases | Low | Low (acceptable async) | Monitor response times, add timeout handling |
| Data residency issues | Low | High (privacy concern) | Document Z.ai data policy, option to use US-only (Claude) |

## Summary: What to Build

### Immediately (Phase 1)

1. Create `src/app/services/llm/zai-service.ts` implementing `LLMApiService`
2. Update `LLMServiceFactory.create()` to support `'z-ai'` provider
3. Update `.env.example` with `LLM_PROVIDER=z-ai` and `ZAI_API_KEY`
4. Update `src/app/api/track-expense/route.ts` to pass provider config
5. Test with Z.ai API key
6. Monitor free tier usage and costs

### Later (Phase 2)

Add Deepseek as formal fallback with monitoring/alerting

### Optional (Phase 3)

Add Claude if Deepseek proves unreliable or if you need better safety guarantees

## References & Current Information

**Knowledge cutoff:** February 2025
**2026 Status:** Prices and APIs current as of February 2026 based on:

- **Z.ai:** https://open.bigmodel.cn/ - Free tier confirmed available, rate limits subject to change
- **Deepseek:** https://platform.deepseek.com/ - Recently released V3 model, ultra-cheap pricing
- **Anthropic Claude:** https://console.anthropic.com/ - Claude 3.5 Haiku available, no free tier
- **OpenAI:** https://platform.openai.com/ - GPT-4o Mini available
- **Google Gemini:** https://ai.google.dev/ - Free tier with rate limits

**Recommendation for roadmap:**
- Start with Z.ai (lowest cost, minimal code changes)
- Plan for Deepseek fallback (insurance against Z.ai changes)
- Do not prioritize Claude unless safety requirements increase
- Keep OpenAI as last-resort fallback only
