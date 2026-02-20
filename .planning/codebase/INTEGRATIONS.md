# External Integrations

## OpenAI API

**Purpose**: Parse natural language transaction descriptions into structured data

**Integration Details**:
- **Service**: `src/app/services/llm/openai-service.ts`
- **Model**: GPT-4o
- **Temperature**: 0.1 (low for consistent parsing)
- **Response Format**: Zod-structured JSON output

**Authentication**:
- API key via `OPENAI_API_KEY` environment variable
- Initialized in `OpenAIService` constructor

**Usage Pattern**:
```typescript
// Input: Natural language description
const result = await llmService.parseTransaction("spent $50 on groceries");

// Output: Structured transaction data
// { motive: "groceries", amount: 50, type: "Expense", category: "Food" }
```

**Error Handling**:
- `InvalidInputError` - When input cannot be parsed
- Generic error for API failures

---

## Google Sheets API

**Purpose**: Persist transaction records to a Google Spreadsheet

**Integration Details**:
- **Service**: `src/app/services/spreadsheet/google-sheets-service.ts`
- **API Version**: v4
- **Scope**: `https://www.googleapis.com/auth/spreadsheets`

**Authentication**:
- Service Account via JWT
- Credentials from environment variables:
  - `GOOGLE_SHEETS_CLIENT_EMAIL`
  - `GOOGLE_SHEETS_PRIVATE_KEY`
  - `GOOGLE_SHEETS_SPREADSHEET_ID`

**Sheet Structure**:
- **Transactions Sheet**: Columns A-E
  - A: Timestamp
  - B: Motive
  - C: Amount
  - D: Type (Income/Expense)
  - E: Category
- **Categories Sheet**: Referenced but not actively used

**Usage Pattern**:
```typescript
await spreadsheetService.appendTransaction([{
  motive: "groceries",
  amount: 50,
  type: "Expense",
  category: "Food"
}]);
```

**Error Handling**:
- `SpreadsheetPermissionError` - Permission denied
- `SpreadsheetWriteError` - Generic write failures

---

## Integration Flow

```
User Request
    ↓
API Route (POST /api/track-expense)
    ↓
LLMService.parseTransaction()
    ↓ (structured data)
SpreadsheetService.appendTransaction()
    ↓
Google Sheets (persisted)
```

## Mock Services

Both integrations have mock implementations for testing:
- `src/app/services/llm/mock-service.ts`
- `src/app/services/spreadsheet/mock-service.ts`

Selected via `NODE_ENV === 'test'` in factory methods.