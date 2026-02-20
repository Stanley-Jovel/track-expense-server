# Track Expenses

## What This Is

A personal expense tracking system that captures spending from Apple Pay transactions via Siri Shortcut, automatically categorizes them into 12 fixed categories using a cost-effective multi-provider LLM (Z.ai primary with fallbacks), detects and prevents duplicate submissions, and (next) provides a dashboard to visualize spending patterns by category and over time.

## Core Value

Low-cost expense tracking with accurate, predictable categorization and clear visibility into where money goes.

## Requirements

### Validated (v1.0)

- ✓ Siri Shortcut captures Apple Pay transactions — existing
- ✓ Server receives raw expense data — existing
- ✓ Google Sheets stores all expenses — existing
- ✓ Basic expense parsing (title, amount) — existing
- ✓ LLM provider switched from ChatGPT to Z.ai GLM-4-Flash (v1.0)
- ✓ Multi-provider abstraction layer with Groq/OpenAI fallbacks (v1.0)
- ✓ Generated 12 fixed expense categories via data-driven script (v1.0)
- ✓ Fixed category system with Zod enum enforcement (v1.0)
- ✓ Input sanitization prevents prompt injection attacks (v1.0)
- ✓ Read-after-write verification ensures data persistence (v1.0)
- ✓ UUID-based duplicate detection via request ID (v1.0)
- ✓ Unknown category fallback to 'Uncategorized' (v1.0)
- ✓ Parse failure recovery (no silent data loss) (v1.0)

### Active (v1.1+)

- [ ] Build React/Next.js frontend dashboard
- [ ] Dashboard: Pie chart showing monthly spending by category (filterable by month)
- [ ] Dashboard: Configurable trend line showing last X months of spending
- [ ] Analytics API with category/time-based spending breakdowns

### Out of Scope

- Search/filter by individual transactions — low priority for MVP
- Budget tracking or spending limits — defer to v2
- Database migration (stay with Google Sheets for cost)
- Mobile app — web dashboard sufficient for v1
- Email/SMS notifications — not needed
- Real-time expense sync optimization — async is fine

## Context

**v1.0 Shipped (2026-02-20):**
- Multi-provider LLM architecture: Z.ai primary (free), Groq ($0.27/M tokens), OpenAI fallback
- 12-category enum (Groceries, Dining, Entertainment, Transport, Utilities, Shopping, Services, Work, Health, Subscriptions, Other, Uncategorized)
- Factory pattern enables provider switching via `LLM_PROVIDER` env var
- Input sanitization prevents prompt injection; cost monitoring logs per-transaction spend
- UUID-based dedup (X-Request-ID) prevents duplicate submissions; 409 response on conflict
- Unknown categories override to Uncategorized; parse failures persist to Sheets instead of dropping
- All expense data still in Google Sheets; backward compatible with existing Siri Shortcut

**Current System State:**
- ~100 TypeScript files, zero linting errors, zero TypeScript errors
- 8 atomic commits (feat(01-01), feat(01-02), feat(02-01), feat(02-02) × 2 for route + sheets)
- All 16 v1.0 requirements verified; 13/13 integration points wired; 6/6 E2E flows tested

**What's Next (v1.1+):**
- Analytics API (Phase 3): GET /api/analytics with month/months filtering
- Frontend Dashboard (Phase 4): React with pie chart + trend line visualizations

## Constraints

- **Cost**: Must be cheaper than ChatGPT (Z.ai GLM-4-Flash is free currently)
- **Data Storage**: Keep Google Sheets (avoids database hosting costs)
- **Frontend**: React/Next.js (matches existing Next.js server)
- **LLM Provider**: Start with Z.ai, but support multiple providers for future flexibility

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| LLM Provider Abstraction | Avoid vendor lock-in, easy to switch to cheaper/better models | ✓ **Good** — Implemented via factory pattern; switched Z.ai → Groq in 1 env var change |
| Multi-provider Fallback Chain | Z.ai free, Groq reliable, OpenAI tested — graceful degradation | ✓ **Good** — Fallback chain tested; transparent failover working |
| Category Generation Script | Infer categories from real data instead of guessing | ✓ **Good** — Data-driven approach eliminates hallucination, script ready for production use |
| 12-category Enum Enforcement | Fix category set, enforce at Zod boundary, prevent LLM drift | ✓ **Good** — Enum validation catches unknown categories; Uncategorized fallback ensures recovery |
| UUID-based Dedup | Request idempotency prevents duplicate charges; 409 response on conflict | ✓ **Good** — Tested; Siri Shortcut retries now safe without duplicating |
| Google Sheets as Database | Cost-effective, already integrated, no migration overhead | ✓ **Good** — Read-after-write verification ensures data safety; getAllTransactions() ready for analytics |
| React Dashboard in Next.js | Leverage existing server, familiar frontend stack | — **Pending** — Phase 3 (Analytics API) in progress; Phase 4 (Dashboard) queued |
| Pie Chart + Trend Line MVP | Start with essential visualizations, expand later | — **Pending** — Phase 3 API will unblock Phase 4 |

---
*Last updated: 2026-02-20 after v1.0 milestone completion*
