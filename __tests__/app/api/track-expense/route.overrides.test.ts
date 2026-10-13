import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { SpreadsheetReadError } from '@/app/services/spreadsheet/types';
import type { ExpenseCategory, ParsedTransaction } from '@/app/services/llm/types';

// Category Overrides at the POST /api/track-expense seam, with mocked LLM and
// spreadsheet services. The sibling route.integration.test.ts runs a real LLM
// against the real sheet, which can't exercise overrides deterministically:
// the LLM's Motive and Category vary run to run, and seeding an override there
// would mean writing the production CategoryOverrides sheet.

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));

// What the LLM "parses" for the next request.
let llmParse: ParsedTransaction[] = [];
jest.mock('@/app/services/llm/factory', () => ({
  LLMServiceFactory: {
    create: () => ({ parseTransaction: async () => llmParse }),
  },
}));

async function postExpense(prompt: string) {
  const res = await POST(
    new Request('http://localhost/api/track-expense', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transaction: prompt }),
    })
  );
  return { status: res.status, body: await res.json() };
}

async function writtenCategories(): Promise<[string, string][]> {
  return (await sheet.readTransactions()).map((t) => [t.motive, t.category]);
}

async function overrideMerchant(merchant: string, category: ExpenseCategory) {
  await sheet.upsertCategoryOverride({ merchant, category, updatedAt: '2026-10-12T00:00:00.000Z' });
}

beforeEach(() => {
  sheet.clear();
  jest.restoreAllMocks();
});

describe('POST /api/track-expense — Category Overrides', () => {
  it('writes the override Category for a Merchant the user corrected', async () => {
    await overrideMerchant('Las Brumas', 'Dining Out');
    llmParse = [
      { motive: 'N1co*las Brumas N1co', amount: 12.5, type: 'Expense', category: 'Shopping — General' },
    ];

    const { status, body } = await postExpense('N1co*las Brumas N1co 12.50');

    expect(status).toBe(200);
    expect(await writtenCategories()).toEqual([['N1co*las Brumas N1co', 'Dining Out']]);
    expect(body.data).toEqual([
      { motive: 'N1co*las Brumas N1co', amount: 12.5, type: 'Expense', category: 'Dining Out' },
    ]);
  });

  it("keeps the LLM's Category for a Merchant with no override", async () => {
    await overrideMerchant('Las Brumas', 'Dining Out');
    llmParse = [{ motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' }];

    const { status, body } = await postExpense('Starbucks 20088 $7');

    expect(status).toBe(200);
    expect(await writtenCategories()).toEqual([['Starbucks 20088', 'Coffee & Quick Bites']]);
    expect(body.data[0].category).toBe('Coffee & Quick Bites');
  });

  it('applies overrides per Transaction in a multi-transaction input', async () => {
    await overrideMerchant('Las Brumas', 'Dining Out');
    await overrideMerchant("Trader Joe's", 'Groceries');
    llmParse = [
      { motive: 'N1CO*LAS BRUMAS', amount: 9.75, type: 'Expense', category: 'Shopping — General' },
      { motive: 'Uber trip', amount: 15, type: 'Expense', category: 'Local Transportation' },
      { motive: "Trader Joe's #123", amount: 42, type: 'Expense', category: 'Shopping — General' },
    ];

    const { status, body } = await postExpense('las brumas 9.75, uber 15, trader joes 42');

    expect(status).toBe(200);
    const expected: [string, string][] = [
      ['N1CO*LAS BRUMAS', 'Dining Out'],
      ['Uber trip', 'Local Transportation'],
      ["Trader Joe's #123", 'Groceries'],
    ];
    expect(await writtenCategories()).toEqual(expected);
    expect(body.data.map((t: ParsedTransaction) => [t.motive, t.category])).toEqual(expected);
  });

  it("still logs the Transaction with the LLM's Category when overrides can't be read", async () => {
    await overrideMerchant('Las Brumas', 'Dining Out');
    jest
      .spyOn(sheet, 'readCategoryOverrides')
      .mockRejectedValue(new SpreadsheetReadError('CategoryOverrides unreachable'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    llmParse = [
      { motive: 'N1co*las Brumas N1co', amount: 12.5, type: 'Expense', category: 'Shopping — General' },
    ];

    const { status, body } = await postExpense('N1co*las Brumas N1co 12.50');

    expect(status).toBe(200);
    expect(await writtenCategories()).toEqual([['N1co*las Brumas N1co', 'Shopping — General']]);
    expect(body.data[0].category).toBe('Shopping — General');
    expect(logged).toHaveBeenCalled();
  });

  it('applies overrides only to Expenses, never to Income from the same Merchant', async () => {
    await overrideMerchant('Las Brumas', 'Dining Out');
    llmParse = [
      { motive: 'N1co*las Brumas N1co', amount: 5, type: 'Income', category: 'Income' },
      { motive: 'N1co*las Brumas N1co', amount: 12.5, type: 'Expense', category: 'Shopping — General' },
    ];

    const { status } = await postExpense('refund las brumas 5, las brumas 12.50');

    expect(status).toBe(200);
    expect(await writtenCategories()).toEqual([
      ['N1co*las Brumas N1co', 'Income'],
      ['N1co*las Brumas N1co', 'Dining Out'],
    ]);
  });
});
