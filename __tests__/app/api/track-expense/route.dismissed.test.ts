import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { type ParsedTransaction } from '@/app/services/llm/types';

jest.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Dismissed spellings at the POST /api/track-expense seam: a suggestion the
// user answered "Not a category" is dropped silently, with F blank.

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
  jest.restoreAllMocks();
});

describe('POST /api/track-expense — dismissed spellings', () => {
  it("drops a dismissed spelling, keeping the LLM's Category, with F blank", async () => {
    await sheet.recordCategorySpellings([
      { spelling: 'misc stuff', outcome: 'Dismissed', target: '', updatedAt: '2026-10-14T00:00:00.000Z' },
    ]);
    llmParse = [
      { motive: 'Venmo', amount: 20, type: 'Expense', category: 'Transfers', suggestedCategory: 'Misc Stuff' },
    ];

    const { status, body } = await postExpense('Venmo 20');

    expect(status).toBe(200);
    expect(await writtenRows()).toEqual([['Venmo', 'Transfers', undefined]]);
    expect(body.data[0].suggestedCategory).toBeUndefined();
  });

  it('files a respelling of a Category even when that spelling was dismissed', async () => {
    await sheet.recordCategorySpellings([
      { spelling: 'clothing', outcome: 'Dismissed', target: '', updatedAt: '2026-10-14T00:00:00.000Z' },
    ]);
    llmParse = [
      {
        motive: 'UNIQLO 0231',
        amount: 39.9,
        type: 'Expense',
        category: 'Shopping — General',
        suggestedCategory: 'Clothing',
      },
    ];

    await postExpense('UNIQLO 0231 39.90');

    expect(await writtenRows()).toEqual([['UNIQLO 0231', 'Clothing', undefined]]);
  });
});
