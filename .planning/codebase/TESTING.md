# Testing

## Testing Framework

**Current State**: No test framework is configured in `package.json`.

The project has infrastructure to support testing but no test files or testing dependencies are present.

## Test Infrastructure

### Mock Services

The codebase includes mock implementations for both external services:

#### Mock LLM Service

**Location**: `src/app/services/llm/mock-service.ts`

```typescript
export class MockLLMService implements LLMApiService {
  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    // Returns hardcoded parsed transaction
    return [{
      motive: 'Test expense',
      amount: 10.00,
      type: 'Expense',
      category: 'Test'
    }];
  }
}
```

#### Mock Spreadsheet Service

**Location**: `src/app/services/spreadsheet/mock-service.ts`

```typescript
export class MockSpreadsheetService implements SpreadsheetService {
  private rows: ParsedTransaction[] = [];
  private shouldFail = false;

  async appendTransaction(data: ParsedTransaction[]): Promise<void> {
    if (this.shouldFail) {
      throw new SpreadsheetPermissionError();
    }
    this.rows.push(...data);
  }

  // Test helper methods
  setShouldFail(fail: boolean): void;
  getRows(): ParsedTransaction[];
  clear(): void;
}
```

### Environment-Based Selection

Services are selected based on `NODE_ENV`:

```typescript
const llmService = LLMServiceFactory.create(
  process.env.NODE_ENV === 'test' ? 'mock' : 'production'
);
```

## Recommended Testing Setup

### Missing Test Dependencies

To add testing, install:

```bash
yarn add -D jest @types/jest ts-jest @testing-library/react
```

### Suggested Test Structure

```
src/
├── __tests__/
│   └── api/
│       └── track-expense.test.ts
└── app/
    └── services/
        ├── llm/
        │   └── __tests__/
        │       └── openai-service.test.ts
        └── spreadsheet/
            └── __tests__/
                └── google-sheets-service.test.ts
```

### Test Coverage Gaps

Areas that would benefit from tests:

1. **API Route** (`src/app/api/track-expense/route.ts`)
   - Input validation
   - Error handling branches
   - Success path

2. **OpenAI Service** (`src/app/services/llm/openai-service.ts`)
   - Valid transaction parsing
   - Invalid input handling
   - API error handling

3. **Google Sheets Service** (`src/app/services/spreadsheet/google-sheets-service.ts`)
   - Successful append
   - Permission errors
   - Generic write errors

4. **Factory Methods**
   - Environment-based selection
   - Unknown type handling