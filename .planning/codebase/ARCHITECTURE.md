# Architecture

**Analysis Date:** 2026-02-19

## Pattern Overview

**Overall:** Service-oriented architecture with factory pattern

**Key Characteristics:**
- Interface-based service abstraction
- Factory pattern for dependency injection
- Strategy pattern for mock/production implementations
- Next.js App Router for HTTP layer
- TypeScript strict mode for type safety

## Layers

**API Layer:**
- Purpose: HTTP request handling, input validation, error mapping
- Location: `src/app/api/`
- Contains: Next.js route handlers (route.ts files)
- Depends on: Service layer (LLM, Spreadsheet)
- Used by: External clients (Siri Shortcuts, curl)

**Service Layer:**
- Purpose: Business logic, external integrations
- Location: `src/app/services/`
- Contains: Interface definitions, implementations, factories, error types
- Depends on: External APIs (OpenAI, Google Sheets)
- Used by: API layer

**Types Layer:**
- Purpose: Shared type definitions
- Location: `src/app/services/*/types.ts`
- Contains: TypeScript interfaces, custom error classes
- Depends on: Nothing (pure TypeScript)
- Used by: Services, API layer

## Data Flow

**Track Expense Flow:**

1. Client POSTs to `/api/track-expense` with `{ transaction: string }`
2. API route validates input presence
3. Factory creates LLM service (mock or production based on NODE_ENV)
4. LLM service parses text into `ParsedTransaction[]`
5. Factory creates Spreadsheet service
6. Spreadsheet service appends transactions to Google Sheets
7. API returns summary message with parsed data

**State Management:**
- Stateless - no server-side session or database
- All state persisted to Google Sheets
- Environment variables for configuration

## Key Abstractions

**LLMApiService Interface:**
- Purpose: Parse natural language into structured transaction data
- Examples: `src/app/services/llm/types.ts`
- Pattern: Interface with factory-created implementations
```typescript
interface LLMApiService {
  parseTransaction(text: string): Promise<ParsedTransaction[]>;
}
```

**SpreadsheetService Interface:**
- Purpose: Persist transaction data to external storage
- Examples: `src/app/services/spreadsheet/types.ts`
- Pattern: Interface with factory-created implementations
```typescript
interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[]): Promise<void>;
}
```

**ParsedTransaction Type:**
- Purpose: Represent structured transaction data
- Examples: `src/app/services/llm/types.ts`
- Fields: `motive: string`, `amount: number`, `type: ExpenseType`, `category: string`

**Custom Error Classes:**
- `InvalidInputError` - LLM parsing failures (user input invalid)
- `SpreadsheetWriteError` - General spreadsheet write failures
- `SpreadsheetPermissionError` - Google Sheets permission issues

## Entry Points

**HTTP POST /api/track-expense:**
- Location: `src/app/api/track-expense/route.ts`
- Triggers: Siri Shortcuts, curl, any HTTP client
- Responsibilities:
  - Parse JSON body
  - Validate `transaction` field exists
  - Create services via factories
  - Handle domain errors (InvalidInputError, SpreadsheetWriteError)
  - Return appropriate HTTP status codes

**Development Server:**
- Location: `package.json` scripts.dev
- Triggers: `yarn dev` or `npm run dev`
- Starts Next.js development server with Turbopack

## Error Handling

**Strategy:** Layered error handling with custom error types

**Patterns:**
- Domain errors extend `Error` class with specific names
- API layer catches domain errors and maps to HTTP status codes
- Unknown errors logged and return generic 500 response
- Factory constructors throw on missing configuration

**Error to HTTP Mapping:**
- `InvalidInputError` -> 400 Bad Request
- `SpreadsheetWriteError` -> 500 Internal Server Error
- Unknown errors -> 500 Internal Server Error

**Error Classes Location:** `src/app/services/*/types.ts`

## Cross-Cutting Concerns

**Logging:** Console.error for unexpected errors in API routes

**Validation:**
- Input presence validation at API layer
- Schema validation via Zod in OpenAI service
- Response structure validation in OpenAI service

**Authentication:** None at API level - OpenAPI key and Google credentials in environment

**Configuration:**
- Environment variables for all secrets
- Constructor-time validation of required config
- NODE_ENV determines mock vs production services

---

*Architecture analysis: 2026-02-19*