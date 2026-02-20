# Track Expenses

## What This Is

A personal expense tracking system that captures spending from Apple Pay transactions via Siri Shortcut, automatically categorizes them into 12 fixed categories using a cost-effective LLM, and provides a dashboard to visualize spending patterns by category and over time.

## Core Value

Low-cost expense tracking with accurate, predictable categorization and clear visibility into where money goes.

## Requirements

### Validated

- ✓ Siri Shortcut captures Apple Pay transactions — existing
- ✓ Server receives raw expense data — existing
- ✓ Google Sheets stores all expenses — existing
- ✓ Basic expense parsing (title, amount) — existing

### Active

- [ ] Switch LLM from ChatGPT to Z.ai GLM-4-Flash (cost reduction)
- [ ] Create LLM provider abstraction layer (swap providers without code changes)
- [ ] Generate 12 fixed expense categories from existing spreadsheet data via script
- [ ] Replace random category selection with fixed 12-category system
- [ ] Build React/Next.js frontend dashboard
- [ ] Dashboard: Pie chart showing monthly spending by category (filterable by month)
- [ ] Dashboard: Configurable trend line showing last X months of spending
- [ ] Ensure all categorization uses new LLM provider abstraction

### Out of Scope

- Search/filter by individual transactions — low priority for MVP
- Budget tracking or spending limits — defer to v2
- Database migration (stay with Google Sheets for cost)
- Mobile app — web dashboard sufficient for v1
- Email/SMS notifications — not needed
- Real-time expense sync optimization — async is fine

## Context

**Current System:**
- Using ChatGPT API for expense categorization (expensive)
- Categories are sparse and unpredictable (LLM chooses randomly)
- All expense data lives in Google Sheets (no traditional database)
- No frontend — user views raw spreadsheet

**What's Needed:**
- Cost-effective LLM provider that can reliably categorize expenses
- Predictable category set derived from actual spending patterns
- Visual analytics to understand spending without opening spreadsheet
- Clean abstraction for easy provider switching as APIs evolve

## Constraints

- **Cost**: Must be cheaper than ChatGPT (Z.ai GLM-4-Flash is free currently)
- **Data Storage**: Keep Google Sheets (avoids database hosting costs)
- **Frontend**: React/Next.js (matches existing Next.js server)
- **LLM Provider**: Start with Z.ai, but support multiple providers for future flexibility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM Provider Abstraction | Avoid vendor lock-in, easy to switch to cheaper/better models | — Pending |
| Category Generation Script | Infer categories from real data instead of guessing | — Pending |
| React Dashboard in Next.js | Leverage existing server, familiar frontend stack | — Pending |
| Google Sheets as Database | Cost-effective, already integrated, no migration overhead | — Pending |
| Pie Chart + Trend Line MVP | Start with essential visualizations, expand later | — Pending |

---
*Last updated: 2026-02-19 after initialization*
