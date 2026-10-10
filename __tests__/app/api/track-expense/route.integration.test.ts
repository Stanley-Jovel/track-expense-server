import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { POST } from '@/app/api/track-expense/route';
import { EXPENSE_CATEGORIES } from '@/app/services/llm/types';

const ALLOWED_CATEGORIES: readonly string[] = EXPENSE_CATEGORIES;

const PROVIDER_KEYS = {
  groq: 'GROQ_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  openai: 'OPENAI_API_KEY',
} as const;
type Provider = keyof typeof PROVIDER_KEYS;

const SHEETS_ENV = [
  'GOOGLE_SHEETS_CLIENT_EMAIL',
  'GOOGLE_SHEETS_PRIVATE_KEY',
  'GOOGLE_SHEETS_SPREADSHEET_ID',
];
const TEST_RANGE = 'Test!A:E';

const hasKey = (p: Provider) => !!process.env[PROVIDER_KEYS[p]];
const sheetsConfigured = SHEETS_ENV.every((k) => !!process.env[k]);

function sheetsClient() {
  const auth = new JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readTestTab(): Promise<string[][]> {
  const res = await sheetsClient().spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    range: TEST_RANGE,
  });
  return res.data.values ?? [];
}

async function postExpense(prompt: string): Promise<Response> {
  const req = new Request('http://localhost/api/track-expense', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transaction: prompt }),
  });
  return POST(req);
}

function breakKeys(...providers: Provider[]): () => void {
  const saved: Record<string, string | undefined> = {};
  for (const p of providers) {
    const k = PROVIDER_KEYS[p];
    saved[k] = process.env[k];
    process.env[k] = 'invalid-key-for-test';
  }
  return () => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
}

const runIf = (cond: boolean) => (cond ? it : it.skip);

// Sheets renders USER_ENTERED numbers as currency ("$1.00"), so compare numerically.
const amountIn = (row: string[]) => parseFloat((row[2] ?? '').replace(/[$,]/g, ''));

describe('POST /api/track-expense — real LLM pipeline + real Google Sheets (Test tab)', () => {
  runIf(sheetsConfigured && hasKey('groq'))(
    'scenario 1 — happy path: groq parses and a row appears in Test',
    async () => {
      const before = (await readTestTab()).length;

      const res = await postExpense('Starbucks coffee $7');
      expect(res.status).toBe(200);

      const after = await readTestTab();
      expect(after.length).toBe(before + 1);
      const row = after[after.length - 1];
      expect(amountIn(row)).toBe(7);
      expect(row[3]).toBe('Expense');
      expect(ALLOWED_CATEGORIES).toContain(row[4]);
    }
  );

  runIf(sheetsConfigured && hasKey('groq') && hasKey('deepseek'))(
    'scenario 2 — fallback to deepseek when groq fails',
    async () => {
      const before = (await readTestTab()).length;
      const restore = breakKeys('groq');
      try {
        const res = await postExpense('Chipotle burrito $14');
        expect(res.status).toBe(200);

        const after = await readTestTab();
        expect(after.length).toBe(before + 1);
        const row = after[after.length - 1];
        expect(amountIn(row)).toBe(14);
        expect(ALLOWED_CATEGORIES).toContain(row[4]);
      } finally {
        restore();
      }
    }
  );

  // Deeper fallback (mistral as 3rd choice, openai as 4th) is chain logic, not
  // wiring, and is covered deterministically by the FallbackLLMService unit
  // tests. Exercising it here would make the suite depend on every provider
  // account staying funded — a present-but-out-of-credits key (hasKey passes,
  // completions fail) turned the old scenarios 3/4 into permanent failures.

  runIf(sheetsConfigured && hasKey('groq'))(
    'scenario 3 — all providers fail: route returns 500 and no row is written',
    async () => {
      const before = (await readTestTab()).length;
      const restore = breakKeys('groq', 'deepseek', 'mistral', 'openai');
      try {
        const res = await postExpense('Whole Foods $87');
        expect(res.status).toBe(500);

        const after = await readTestTab();
        expect(after.length).toBe(before);
      } finally {
        restore();
      }
    }
  );
});

if (!sheetsConfigured) {
  console.warn(
    `[route.integration.test] skipping — missing one of: ${SHEETS_ENV.join(', ')}`
  );
}
