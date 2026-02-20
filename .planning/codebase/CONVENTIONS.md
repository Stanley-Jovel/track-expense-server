# Coding Conventions

## Code Style

### TypeScript

- **Strict mode**: Enabled in `tsconfig.json`
- **No implicit any**: Enforced via strict mode
- **ES modules**: Using `import/export` syntax
- **Path aliases**: `@/*` maps to `./src/*`

### File Naming

- **Services**: kebab-case (e.g., `openai-service.ts`, `google-sheets-service.ts`)
- **Types**: `types.ts` for shared type definitions
- **Index files**: `index.ts` for barrel exports

### Import Organization

```typescript
// 1. External packages
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// 2. Internal aliases
import { LLMServiceFactory } from '@/app/services/llm';

// 3. Relative imports
import { ParsedTransaction } from './types';
```

## Naming Conventions

### Classes

- **Services**: PascalCase with descriptive names
  - `OpenAIService`, `GoogleSheetsService`, `MockLLMService`
- **Factories**: PascalCase with `Factory` suffix
  - `LLMServiceFactory`, `SpreadsheetServiceFactory`
- **Errors**: PascalCase with `Error` suffix
  - `InvalidInputError`, `SpreadsheetWriteError`

### Interfaces

- **Service interfaces**: PascalCase describing capability
  - `LLMApiService`, `SpreadsheetService`
- **Data interfaces**: PascalCase describing entity
  - `ParsedTransaction`

### Variables

- **camelCase** for variables and methods
- **UPPER_SNAKE_CASE** for static constants
  - `SYSTEM_PROMPT`, `ParsedTransactionsSchema`

## Error Handling Pattern

### Custom Error Classes

```typescript
export class InvalidInputError extends Error {
  constructor(message: string = 'Invalid input format') {
    super(message);
    this.name = 'InvalidInputError';
  }
}
```

### Error Hierarchy

- `InvalidInputError` - User input validation
- `SpreadsheetWriteError` - Base class for spreadsheet errors
- `SpreadsheetPermissionError` - Specific permission error

### API Route Error Handling

```typescript
try {
  // Business logic
} catch (error) {
  if (error instanceof InvalidInputError) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  if (error instanceof SpreadsheetWriteError) {
    return NextResponse.json({ message: 'Failed to log expense' }, { status: 500 });
  }
  throw error; // Re-throw unexpected errors
}
```

## Design Patterns

### Factory Pattern

Used for service instantiation with environment-based selection:

```typescript
export class LLMServiceFactory {
  static create(type: 'production' | 'mock' = 'production'): LLMApiService {
    switch (type) {
      case 'mock':
        return new MockLLMService();
      case 'production':
        return new OpenAIService();
    }
  }
}
```

### Interface Segregation

Services implement minimal interfaces:

```typescript
export interface LLMApiService {
  parseTransaction(text: string): Promise<ParsedTransaction[]>;
}

export interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[]): Promise<void>;
}
```

### Barrel Exports

Each service directory exports via `index.ts`:

```typescript
export * from './factory';
export * from './openai-service';
export * from './types';
```

## Code Organization

### Service Layer Structure

```
src/app/services/
├── llm/
│   ├── types.ts          # Interfaces and error classes
│   ├── openai-service.ts # Production implementation
│   ├── mock-service.ts   # Test implementation
│   ├── factory.ts        # Service factory
│   └── index.ts          # Barrel export
└── spreadsheet/
    └── (same structure)
```

### API Routes

- Located in `src/app/api/`
- Follow Next.js App Router conventions
- Export named `GET`, `POST`, etc. functions