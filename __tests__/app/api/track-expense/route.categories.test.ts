import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { SpreadsheetReadError } from '@/app/services/spreadsheet/types';
import type { ParsedTransaction } from '@/app/services/llm/types';
import { BUILT_IN_CATEGORY_NAMES } from '@/app/services/categories/category-list';

// The Category list at the POST /api/track-expense seam: ingest reads it from
// the Categories sheet (mock spreadsheet service) and hands it to a mocked
// LLM, falling back to the built-in list when the sheet can't be read.

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));

// What the LLM "parses" for the next request, and the list it was offered.
let llmParse: ParsedTransaction[] = [];
let offered: readonly string[] = [];
jest.mock('@/app/services/llm/factory', () => ({
  LLMServiceFactory: {
    create: () => ({
      parseTransaction: async (_text: string, categories: readonly string[]) => {
        offered = categories;
        return llmParse;
      },
    }),
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

beforeEach(() => {
  sheet.clear();
  offered = [];
  jest.restoreAllMocks();
});

describe('POST /api/track-expense — the Category list', () => {
  it('accepts a Category added to the list by hand', async () => {
    await sheet.addCategory({ name: 'Pet Supplies', countsAsSpending: true });
    llmParse = [{ motive: 'PetSmart #0412', amount: 38, type: 'Expense', category: 'Pet Supplies' }];

    const { status, body } = await postExpense('PetSmart 38');

    expect(status).toBe(200);
    expect(offered).toContain('Pet Supplies');
    expect(await writtenCategories()).toEqual([['PetSmart #0412', 'Pet Supplies']]);
    expect(body.data[0].category).toBe('Pet Supplies');
  });

  it('honors a Category Override to a Category added to the list', async () => {
    await sheet.addCategory({ name: 'Pet Supplies', countsAsSpending: true });
    await sheet.upsertCategoryOverride({
      merchant: 'Chewy',
      category: 'Pet Supplies',
      updatedAt: '2026-10-14T00:00:00.000Z',
    });
    llmParse = [{ motive: 'Chewy', amount: 54, type: 'Expense', category: 'Shopping — General' }];

    const { status } = await postExpense('Chewy 54');

    expect(status).toBe(200);
    expect(await writtenCategories()).toEqual([['Chewy', 'Pet Supplies']]);
  });

  it("uses the built-in list and still logs the Transaction when the Categories can't be read", async () => {
    jest
      .spyOn(sheet, 'readCategories')
      .mockRejectedValue(new SpreadsheetReadError('Categories unreachable'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    llmParse = [{ motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' }];

    const { status } = await postExpense('Starbucks 20088 $7');

    expect(status).toBe(200);
    expect(offered).toEqual(BUILT_IN_CATEGORY_NAMES);
    expect(await writtenCategories()).toEqual([['Starbucks 20088', 'Coffee & Quick Bites']]);
    expect(logged).toHaveBeenCalled();
  });
});
