# Technology Stack

## Language & Runtime

- **Language**: TypeScript 5.x
- **Runtime**: Node.js (Next.js server environment)
- **Target**: ES2017

## Framework

- **Framework**: Next.js 15.1.7 (App Router)
- **React**: 19.0.0
- **Build Tool**: Turbopack (via `next dev --turbopack`)

## Core Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.1.7 | Web framework with App Router |
| `react` | ^19.0.0 | UI library |
| `react-dom` | ^19.0.0 | React DOM renderer |
| `openai` | ^4.85.4 | OpenAI API client for GPT-4o |
| `googleapis` | ^144.0.0 | Google Sheets API integration |
| `google-auth-library` | ^9.15.1 | JWT authentication for Google APIs |
| `zod` | ^3.24.2 | Schema validation with OpenAI structured outputs |

### Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | TypeScript compiler |
| `@types/node` | ^20 | Node.js type definitions |
| `@types/react` | ^19 | React type definitions |
| `@types/react-dom` | ^19 | React DOM type definitions |
| `eslint` | ^9 | Linting |
| `eslint-config-next` | 15.1.7 | Next.js ESLint rules |
| `@eslint/eslintrc` | ^3 | ESLint configuration |

## Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration (strict mode enabled)
- `next.config.ts` - Next.js configuration
- `eslint.config.mjs` - ESLint flat config with Next.js rules

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": { "@/*": ["./src/*"] }
  }
}
```

## Environment Variables

Required environment variables (see `.env.example`):

- `OPENAI_API_KEY` - OpenAI API key for GPT-4o
- `GOOGLE_SHEETS_CLIENT_EMAIL` - Google Service Account email
- `GOOGLE_SHEETS_PRIVATE_KEY` - Google Service Account private key
- `GOOGLE_SHEETS_SPREADSHEET_ID` - Target Google Sheets ID

## Package Manager

- Uses `yarn` (indicated by `yarn.lock` presence)