# Technical Concerns

## High Priority

### 1. No Test Coverage

**Issue**: The project has zero test files and no testing framework configured.

**Impact**:
- No regression protection
- Difficult to refactor safely
- Unknown behavior in edge cases

**Recommendation**:
- Add Jest or Vitest
- Write unit tests for service layer
- Add integration tests for API route

---

### 2. Missing Input Validation

**Issue**: The API route only checks if `transaction` exists, but doesn't validate its type or content.

**Location**: `src/app/api/track-expense/route.ts:7-8`

```typescript
const body: { transaction: string } = await request.json();
const transaction = body.transaction;
```

**Impact**:
- `transaction` could be any type (object, array, null)
- No length limits on input
- Potential for unexpected behavior

**Recommendation**:
- Add Zod validation for request body
- Limit input length
- Validate input is a non-empty string

---

## Medium Priority

### 3. Hardcoded LLM Model

**Issue**: Model name `gpt-4o` is hardcoded in `OpenAIService`.

**Location**: `src/app/services/llm/openai-service.ts:34`

```typescript
model: "gpt-4o",
```

**Impact**:
- Cannot easily switch models
- No A/B testing capability
- Cost considerations locked in

**Recommendation**:
- Make model configurable via environment variable

---

### 4. No Rate Limiting

**Issue**: The API endpoint has no rate limiting protection.

**Impact**:
- Vulnerable to abuse
- Unbounded OpenAI API costs
- Potential DoS vector

**Recommendation**:
- Add rate limiting middleware
- Consider per-IP and per-user limits

---

### 5. Basic Error Message Detection

**Issue**: Permission error detection relies on string matching.

**Location**: `src/app/services/spreadsheet/google-sheets-service.ts:71`

```typescript
if (error instanceof Error && error.message.includes('permission')) {
```

**Impact**:
- Fragile error handling
- Could miss actual permission errors
- Could misidentify other errors

**Recommendation**:
- Use Google API error codes if available
- Create more robust error classification

---

## Low Priority

### 6. No Logging Infrastructure

**Issue**: Only `console.error` is used for error logging.

**Location**: `src/app/api/track-expense/route.ts:55`

**Impact**:
- No structured logging
- No request tracing
- Difficult debugging in production

**Recommendation**:
- Add structured logging (e.g., Pino, Winston)
- Include request IDs for tracing

---

### 7. Unused Sheet Reference

**Issue**: `sheetNames.categories` is defined but never used.

**Location**: `src/app/services/spreadsheet/google-sheets-service.ts:10-13`

```typescript
private sheetNames = {
  transactions: 'Transactions',
  categories: 'Categories', // Not used
}
```

**Recommendation**:
- Remove if not planned
- Document if reserved for future use

---

### 8. No TypeScript Return Types on API Handlers

**Issue**: API route handler doesn't have explicit return type.

**Location**: `src/app/api/track-expense/route.ts:5`

```typescript
export async function POST(request: Request) { // No return type
```

**Recommendation**:
- Add explicit `Promise<NextResponse>` return type

---

## Security Considerations

### Environment Variables

- Credentials are properly externalized to `.env`
- `.env` is in `.gitignore`
- `.env.example` provides template without secrets

### Input Sanitization

- No explicit sanitization of transaction text before sending to OpenAI
- Potential for prompt injection (low risk given controlled context)

---

## Performance Considerations

- Each request makes sequential API calls (OpenAI → Google Sheets)
- No caching implemented
- No connection pooling for Google Sheets client