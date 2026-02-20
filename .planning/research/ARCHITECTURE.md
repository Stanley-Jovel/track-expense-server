# Architecture Patterns

**Domain:** Personal expense tracking with LLM-powered categorization and dashboard analytics
**Researched:** 2026-02-19
**Based on:** Existing implementation analysis + project requirements

## Recommended Architecture

The expense tracking system uses a **layered architecture with a clear service abstraction pattern** to support multiple LLM providers and decouple data storage from business logic.

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├──────────────────────┬──────────────────────────────────────────┤
│  Siri Shortcut       │  React/Next.js Dashboard                 │
│  (Apple Pay capture) │  (Analytics: Pie chart, Trend line)      │
└──────────────────────┴──────────────────────────────────────────┘
                              │
                       HTTP / REST API
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Server Layer                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  API Routes                                               │  │
│  │  • POST /api/track-expense  (receive & parse transaction) │  │
│  │  • GET  /api/analytics      (monthly spending data)       │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
    ┌───────▼───────┐  ┌─────▼──────┐  ┌──────▼───────┐
    │  LLM Service  │  │  Category  │  │ Spreadsheet  │
    │  Abstraction  │  │ Generation │  │  Service     │
    │  Layer        │  │  Service   │  │  Abstraction │
    └───────┬───────┘  └─────┬──────┘  └──────┬───────┘
            │                │               │
    ┌───────▼────────────────▼───┐    ┌──────▼────────┐
    │  LLM Providers             │    │  Google Sheets│
    │  • OpenAI (gpt-4o)         │    │  (Append data)│
    │  • Z.ai GLM-4-Flash (TODO) │    │               │
    │  • Mock Service (Testing)  │    └───────────────┘
    └────────────────────────────┘
```

## Component Boundaries

| Component | Responsibility | Communicates With | Notes |
|-----------|---------------|-------------------|-------|
| **Siri Shortcut Client** | Capture Apple Pay transaction & send to server | Track Expense API | Entry point; no logic beyond HTTP POST |
| **Track Expense API** | Receive raw transaction, validate, orchestrate | LLM Service, Spreadsheet Service | Coordinates flow: parse → validate → append |
| **LLM Service Abstraction** | Define interface for transaction parsing | Concrete LLM providers | Factory pattern allows provider swapping |
| **OpenAI Service** | Call OpenAI gpt-4o, parse response, validate schema | OpenAI API (external) | Current implementation; uses Zod for validation |
| **Category Generation Service** | Generate 12-category set from historical data | Google Sheets | Not yet implemented; infers from existing data |
| **Spreadsheet Service Abstraction** | Define interface for data persistence | Google Sheets Service | Supports future database swaps |
| **Google Sheets Service** | Append parsed transactions to spreadsheet | Google Sheets API (external) | Stores: timestamp, motive, amount, type, category |
| **Analytics API** | Query aggregated spending by category | Google Sheets Service | Not yet implemented; will serve dashboard |
| **Dashboard Component** | Display pie chart (monthly by category) + trend line | Analytics API | React/Next.js frontend; client-side rendering |

## Data Flow

### Flow 1: Expense Capture and Categorization

```
Siri Shortcut (Apple Pay)
  │ "Just paid $15.50 at Starbucks"
  ▼
POST /api/track-expense
  │ { transaction: "Just paid $15.50 at Starbucks" }
  ▼
LLMServiceFactory.create()
  │ Returns OpenAIService (or GLM-4-Flash in future)
  ▼
OpenAIService.parseTransaction()
  │ Calls: gpt-4o with Zod schema
  │ Returns: { motive, amount, type, category }
  ▼
SpreadsheetServiceFactory.create()
  │ Returns GoogleSheetsService
  ▼
GoogleSheetsService.appendTransaction()
  │ Appends row: [timestamp, motive, amount, type, category]
  │ Target: Transactions sheet in Google Sheets
  ▼
Response to Siri Shortcut
  │ "Spent $15.50 for Coffee"
```

### Flow 2: Dashboard Analytics Query

```
React Dashboard Component
  │ User opens dashboard, selects month
  ▼
GET /api/analytics?month=2026-02&groupBy=category
  ▼
SpreadsheetService.getTransactionsByMonth()
  │ Query Google Sheets Transactions sheet
  │ Filter by date range
  ▼
Aggregate by Category
  │ Group: [Coffee: $45.20, Food: $120.00, ...]
  ▼
Return JSON to Frontend
  │ [{ category, totalAmount }, ...]
  ▼
Dashboard Charts
  │ Pie chart: category breakdown
  │ Trend line: monthly spending over time
```

### Data Structure

**Parsed Transaction (in-flight):**
```typescript
{
  motive: string;        // "Coffee at Starbucks"
  amount: number;        // 15.50
  type: 'Income' | 'Expense';  // 'Expense'
  category: string;      // "Coffee" (from 12-category set)
}
```

**Spreadsheet Row:**
```
[timestamp] [motive] [amount] [type] [category]
02/19/2026 14:30:45 | Coffee at Starbucks | 15.50 | Expense | Coffee
```

## Architectural Patterns

### Pattern 1: Service Factory Pattern

**What:** Abstract service creation behind a factory that returns an interface-based service.

**When:** Use when:
- Multiple implementations exist (OpenAI, Z.ai GLM, Mock)
- Implementation varies by environment (test vs production)
- Need to decouple client code from concrete implementations

**Example:**
```typescript
// Factory decides which service to instantiate
const llmService = LLMServiceFactory.create(
  process.env.NODE_ENV === 'test' ? 'mock' : 'production'
);

// Client only knows the interface
interface LLMApiService {
  parseTransaction(text: string): Promise<ParsedTransaction[]>;
}

// Easy to swap providers:
// LLMServiceFactory.create('production') → OpenAIService
// LLMServiceFactory.create('production') → GLM4FlashService (future)
```

**Benefit:** Adding Z.ai GLM-4-Flash requires only:
1. New `GLM4FlashService` implementing `LLMApiService`
2. Add case to factory switch statement
3. Zero changes to API route logic

### Pattern 2: Repository/Data Access Layer

**What:** Encapsulate data persistence (Google Sheets) behind a service abstraction.

**When:** Use when:
- Multiple storage backends possible (Sheets, DB, cache)
- Want to decouple business logic from storage details
- Need to swap storage without rewriting orchestration code

**Example:**
```typescript
interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[]): Promise<void>;
}

// Current: GoogleSheetsService
// Future: DatabaseService, CacheService
```

### Pattern 3: Orchestration Layer (API Route)

**What:** API route (track-expense) orchestrates flow: validate → LLM → storage.

**When:** Use for:
- Coordinating multiple services
- Handling errors from each step
- Business logic that spans services

**Benefit:** Single place to see full transaction flow; easy to add logging, monitoring, validation steps.

## Integration Points for Multiple LLM Providers

### Current (OpenAI-only)

```typescript
// Hard-coded to OpenAI
const completion = await this.client.chat.completions.create({
  model: "gpt-4o",
  messages: [...],
  response_format: zodResponseFormat(...)
});
```

### Required Changes for GLM-4-Flash (and Future Providers)

1. **Create new provider class:**
   ```typescript
   export class GLM4FlashService implements LLMApiService {
     async parseTransaction(text: string): Promise<ParsedTransaction[]> {
       // Call Z.ai API with same interface
       // Return ParsedTransaction[] (same structure)
     }
   }
   ```

2. **Register in factory:**
   ```typescript
   case 'glm4flash':
     return new GLM4FlashService();
   ```

3. **Select at runtime:**
   ```typescript
   const provider = process.env.LLM_PROVIDER || 'openai';
   const llmService = LLMServiceFactory.create(provider);
   ```

4. **What stays the same:**
   - API route logic (track-expense)
   - Spreadsheet service
   - Response schema (ParsedTransaction)
   - Dashboard code

### Design Principle: Provider Agnostic

The architecture **intentionally hides provider details** behind the `LLMApiService` interface. This means:
- Adding providers = add service class + factory case
- Removing providers = delete service class + factory case
- No changes to business logic or API routes

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M users |
|---------|--------------|--------------|-------------|
| **Transaction Throughput** | Sync parse + append (100ms/tx) fine | Consider batch operations (queue) | Async job queue + batch inserts required |
| **Google Sheets I/O** | Direct append via API; <5ms latency | Append API can handle ~10K rows/day | Sheets not designed for 1M transactions; migrate to DB |
| **LLM Costs** | ~$0.05/tx (gpt-4o); manageable | Switch to GLM-4-Flash ($0 or <$0.001) | Consider local model or cheaper provider |
| **Dashboard Load** | Query all data; <100ms | Filter by month in Sheets query; ~500ms | Dashboard backend caching + pagination required |
| **Auth/Rate Limiting** | Not implemented | Add API key auth + rate limits | Auth required; per-user rate limits |

**Action:** At Phase 3 (Dashboard), evaluate Sheets API limits and plan DB migration if expecting >100K transactions.

## API Contract Examples

### POST /api/track-expense

**Request:**
```json
{
  "transaction": "Just spent $25 on groceries at Whole Foods"
}
```

**Response (Success):**
```json
{
  "message": "Spent 25 for Groceries",
  "data": [
    {
      "motive": "Groceries at Whole Foods",
      "amount": 25,
      "type": "Expense",
      "category": "Groceries"
    }
  ]
}
```

**Response (Invalid Input):**
```json
{
  "message": "Invalid input format"
}
Status: 400
```

**Response (Sheets Write Error):**
```json
{
  "message": "Failed to log expense"
}
Status: 500
```

### GET /api/analytics?month=2026-02 (Planned)

**Response:**
```json
{
  "month": "2026-02",
  "total": 1250.50,
  "byCategory": [
    { "category": "Food", "amount": 350.00 },
    { "category": "Coffee", "amount": 125.50 },
    { "category": "Transport", "amount": 200.00 },
    ...
  ]
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Hard-Coded LLM Provider

**What:** Embedding OpenAI calls directly in API route without abstraction.

**Why bad:**
- Switching to Z.ai requires rewriting API route
- Testing requires mocking OpenAI client
- Multiple providers in same codebase becomes messy

**Instead:** Use factory pattern + service interface (already implemented correctly).

### Anti-Pattern 2: Direct API Logic in Service Classes

**What:** Services handling both business logic and API formatting.

**Why bad:**
- Services become tightly coupled to HTTP layer
- Harder to reuse services in background jobs or CLI tools

**Instead:** Keep services focused on single responsibility (parse, store). API route handles orchestration.

### Anti-Pattern 3: Tight Coupling to Google Sheets Schema

**What:** Hardcoding column indices or sheet names in business logic.

**Why bad:**
- Schema changes break multiple code locations
- Harder to migrate to database

**Instead:** Encapsulate schema in service class (already done: `sheetNames` object).

### Anti-Pattern 4: Missing Error Handling Between Services

**What:** Not distinguishing between validation errors vs system errors.

**Why bad:**
- User sees generic "Internal server error" for bad input
- Hard to debug actual failures

**Instead:** Custom error types for each service (InvalidInputError, SpreadsheetWriteError) and handle per type (already implemented).

## Sources

- **Existing implementation:** `/Users/stanley/Projects/track-expense-server/src/app/services/`
- **Project context:** `.planning/PROJECT.md` — requirements and constraints
- **Service interfaces:** Zod-based schema validation for type safety across services

## Suggested Build Order (Phase Dependencies)

1. **Phase 1: LLM Provider Abstraction** (CURRENT)
   - Implement Z.ai GLM-4-Flash service
   - Update factory to support selection via env var
   - Test both OpenAI and Z.ai in parallel

2. **Phase 2: Category Generation** (Depends on Phase 1)
   - Infer 12-category set from existing Sheets data
   - Validate fixed categories in LLM prompt
   - Test category consistency

3. **Phase 3: Analytics API** (Independent)
   - Build GET /api/analytics with month filtering
   - Test Sheets query performance
   - Flag if scaling needed

4. **Phase 4: Dashboard** (Depends on Phase 3)
   - React components: Pie chart + Trend line
   - Month selector
   - Integration with Analytics API

5. **Phase 5: Polish & Scale** (Depends on Phases 1-4)
   - Auth layer (if needed)
   - Rate limiting
   - Batch transaction processing
   - Consider DB migration path if >100K transactions expected
