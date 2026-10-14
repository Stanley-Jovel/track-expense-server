import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { type ParsedTransaction } from '@/app/services/llm/types';
import { listSuggestions } from '@/app/dashboard/suggestions';

// The listing function reads through the dashboard's cache; jest has no
// Next cache, so it reads straight through.
jest.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Category Suggestions at the POST /api/track-expense seam: a mocked LLM
// suggests a Category, and what lands in column F (Suggested Category) of
// the mock spreadsheet service is checked.

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));

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

/** [Motive, Category, Suggested Category] of every row in the sheet. */
async function writtenRows(): Promise<[string, string, string | undefined][]> {
  return (await sheet.readTransactions()).map((t) => [t.motive, t.category, t.suggestedCategory]);
}

beforeEach(() => {
  sheet.clear();
});

describe('POST /api/track-expense — Category Suggestions', () => {
  it("writes an Expense's suggestion to F, filed under the LLM's Category meanwhile", async () => {
    llmParse = [
      {
        motive: 'PETSMART #0412',
        amount: 38.5,
        type: 'Expense',
        category: 'Shopping — General',
        suggestedCategory: 'Pet Supplies',
      },
    ];

    const { status } = await postExpense('PETSMART #0412 38.50');

    expect(status).toBe(200);
    expect(await writtenRows()).toEqual([['PETSMART #0412', 'Shopping — General', 'Pet Supplies']]);
  });

  it('groups spelling variants of a suggestion into one Category Suggestion', async () => {
    llmParse = [
      { motive: 'PETSMART #0412', amount: 38.5, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Pet Supplies' },
    ];
    await postExpense('PETSMART #0412 38.50');
    llmParse = [
      { motive: 'Chewy.com', amount: 54, type: 'Expense', category: 'Groceries', suggestedCategory: 'pet supply' },
    ];
    await postExpense('Chewy.com 54');

    const suggestions = await listSuggestions();

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].label).toBe('Pet Supplies');
    expect(suggestions[0].entries.map((e) => e.motive)).toEqual(['PETSMART #0412', 'Chewy.com']);
  });

  it('never writes F for Income', async () => {
    llmParse = [
      { motive: 'Payroll', amount: 2400, type: 'Income', category: 'Income', suggestedCategory: 'Salary' },
    ];

    const { status, body } = await postExpense('Payroll 2400');

    expect(status).toBe(200);
    expect(await writtenRows()).toEqual([['Payroll', 'Income', undefined]]);
    expect(body.data[0].suggestedCategory).toBeUndefined();
  });

  it('writes no F for an Expense that fits the list', async () => {
    llmParse = [{ motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' }];

    await postExpense('Starbucks 20088 $7');

    expect(await writtenRows()).toEqual([['Starbucks 20088', 'Coffee & Quick Bites', undefined]]);
  });

  it("clears the suggestion of an Expense whose Merchant has a Category Override", async () => {
    await sheet.upsertCategoryOverride({
      merchant: 'Chewy',
      category: 'Shopping — General',
      updatedAt: '2026-10-14T00:00:00.000Z',
    });
    llmParse = [
      {
        motive: 'Chewy',
        amount: 54,
        type: 'Expense',
        category: 'Groceries',
        suggestedCategory: 'Pet Supplies',
      },
    ];

    await postExpense('Chewy 54');

    expect(await writtenRows()).toEqual([['Chewy', 'Shopping — General', undefined]]);
  });
});
