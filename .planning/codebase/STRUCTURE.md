# Codebase Structure

**Analysis Date:** 2026-02-19

## Directory Layout

```
track-expense-server/
├── src/                          # Source code
│   └── app/                      # Next.js App Router
│       ├── api/                  # API route handlers
│       │   └── track-expense/    # Track expense endpoint
│       ├── services/             # Business logic services
│       │   ├── llm/              # LLM parsing service
│       │   └── spreadsheet/      # Spreadsheet persistence service
│       ├── layout.tsx            # Root layout component
│       ├── page.tsx              # Home page (unused placeholder)
│       └── globals.css           # Global styles
├── public/                       # Static assets
├── .planning/                    # Planning documents
├── node_modules/                 # Dependencies
├── .next/                        # Next.js build output
├── package.json                  # Package manifest
├── tsconfig.json                 # TypeScript config
├── next.config.ts                # Next.js config
├── eslint.config.mjs             # ESLint config
├── .env                          # Environment variables (gitignored)
├── .env.example                  # Environment template
├── .cursorrules                  # Cursor AI project rules
├── README.md                     # Project documentation
└── LICENSE                       # MIT License
```

## Directory Purposes

**src/app/api:**
- Purpose: Next.js API route handlers
- Contains: Route handler files (route.ts)
- Key files: `src/app/api/track-expense/route.ts`

**src/app/services:**
- Purpose: Business logic and external integrations
- Contains: Service modules with interfaces, implementations, factories
- Key files: See service directories below

**src/app/services/llm:**
- Purpose: Natural language parsing for transactions
- Contains: LLM service implementations (OpenAI, Mock)
- Key files: `types.ts`, `factory.ts`, `openai-service.ts`, `mock-service.ts`, `index.ts`

**src/app/services/spreadsheet:**
- Purpose: Transaction persistence to Google Sheets
- Contains: Spreadsheet service implementations (Google Sheets, Mock)
- Key files: `types.ts`, `factory.ts`, `google-sheets-service.ts`, `mock-service.ts`, `index.ts`

**public:**
- Purpose: Static assets served directly
- Contains: SVG images (Next.js logo, Vercel logo, icons)
- Note: Currently placeholder assets from create-next-app

**.planning:**
- Purpose: GSD planning documents
- Contains: Codebase analysis documents
- Generated: Yes
- Committed: No (in .gitignore)

## Key File Locations

**Entry Points:**
- `src/app/api/track-expense/route.ts`: Main API endpoint handler
- `src/app/layout.tsx`: React root layout with fonts
- `src/app/page.tsx`: Home page (placeholder)

**Configuration:**
- `package.json`: Dependencies and scripts
- `tsconfig.json`: TypeScript configuration (strict mode, @/* alias)
- `next.config.ts`: Next.js configuration
- `eslint.config.mjs`: ESLint rules
- `.env.example`: Environment variable template

**Core Logic:**
- `src/app/services/llm/types.ts`: LLM interface and error types
- `src/app/services/llm/factory.ts`: LLM service factory
- `src/app/services/llm/openai-service.ts`: OpenAI implementation
- `src/app/services/llm/mock-service.ts`: Mock implementation for testing
- `src/app/services/spreadsheet/types.ts`: Spreadsheet interface and error types
- `src/app/services/spreadsheet/factory.ts`: Spreadsheet service factory
- `src/app/services/spreadsheet/google-sheets-service.ts`: Google Sheets implementation
- `src/app/services/spreadsheet/mock-service.ts`: Mock implementation for testing

**Barrel Exports:**
- `src/app/services/llm/index.ts`: Re-exports all LLM module exports
- `src/app/services/spreadsheet/index.ts`: Re-exports all spreadsheet module exports

## Naming Conventions

**Files:**
- Components: `kebab-case.tsx` (e.g., `google-sheets-service.ts`)
- Routes: `route.ts` (Next.js convention)
- Types: `types.ts` (centralized type definitions)
- Factories: `factory.ts`
- Barrel exports: `index.ts`
- Styles: `*.module.css` (CSS modules)

**Classes:**
- Services: PascalCase with Service suffix (e.g., `OpenAIService`, `GoogleSheetsService`)
- Factories: PascalCase with Factory suffix (e.g., `LLMServiceFactory`)
- Errors: PascalCase with Error suffix (e.g., `InvalidInputError`)

**Interfaces:**
- PascalCase with no prefix (e.g., `LLMApiService`, `SpreadsheetService`)

**Variables:**
- camelCase for local variables and functions
- SCREAMING_SNAKE_CASE for static constants (e.g., `SYSTEM_PROMPT`)

## Where to Add New Code

**New API Endpoint:**
- Create directory: `src/app/api/{endpoint-name}/`
- Create handler: `src/app/api/{endpoint-name}/route.ts`

**New Service:**
- Create directory: `src/app/services/{service-name}/`
- Create files: `types.ts`, `factory.ts`, `{implementation}-service.ts`, `mock-service.ts`, `index.ts`
- Follow existing pattern in `llm/` or `spreadsheet/`

**New Service Implementation (e.g., different LLM provider):**
- Add implementation: `src/app/services/llm/{provider}-service.ts`
- Update factory: `src/app/services/llm/factory.ts`
- Export from barrel: `src/app/services/llm/index.ts`

**New Error Type:**
- Add to appropriate: `src/app/services/{service}/types.ts`
- Extend `Error` class with custom name

**New Transaction Field:**
- Update: `src/app/services/llm/types.ts` (ParsedTransaction interface)
- Update: `src/app/services/llm/openai-service.ts` (Zod schema, validation)
- Update: `src/app/services/spreadsheet/google-sheets-service.ts` (row mapping)

**New Page/Component:**
- Page: `src/app/{route-segment}/page.tsx`
- Component: Create component file in appropriate directory

## Special Directories

**.next:**
- Purpose: Next.js build output and cache
- Generated: Yes (by `next build` and `next dev`)
- Committed: No

**node_modules:**
- Purpose: npm dependencies
- Generated: Yes (by `yarn install`)
- Committed: No

**public:**
- Purpose: Static assets
- Generated: No
- Committed: Yes

---

*Structure analysis: 2026-02-19*