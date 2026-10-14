import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { type ParsedTransaction } from '@/app/services/llm/types';
import { SpreadsheetReadError } from '@/app/services/spreadsheet/types';

jest.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// Category Spellings at the POST /api/track-expense seam: a suggestion that
// means a Category the user already has is filed under it, with F blank.

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

function uniqloSuggesting(suggestedCategory: string): ParsedTransaction[] {
  return [
    { motive: 'UNIQLO 0231', amount: 39.9, type: 'Expense', category: 'Shopping — General', suggestedCategory },
  ];
}

beforeEach(() => {
  sheet.clear();
  jest.restoreAllMocks();
});

describe('POST /api/track-expense — Category Spellings', () => {
  it('files a respelling of a Category under that Category, with F blank', async () => {
    llmParse = uniqloSuggesting('clothings!');

    const { status, body } = await postExpense('UNIQLO 0231 39.90');

    expect(status).toBe(200);
    expect(await writtenRows()).toEqual([['UNIQLO 0231', 'Clothing', undefined]]);
    expect(body.data[0]).toEqual(expect.objectContaining({ category: 'Clothing' }));
    expect(body.data[0].suggestedCategory).toBeUndefined();
  });

  it('files a spelling recorded as an Alias under its Category, with F blank', async () => {
    await sheet.recordCategorySpellings([
      { spelling: 'clothe', outcome: 'Alias', target: 'Clothing', updatedAt: '2026-10-14T00:00:00.000Z' },
    ]);
    llmParse = uniqloSuggesting('Clothes');

    await postExpense('UNIQLO 0231 39.90');

    expect(await writtenRows()).toEqual([['UNIQLO 0231', 'Clothing', undefined]]);
  });

  it("still logs the Transaction, suggestion in F, when the spellings can't be read", async () => {
    await sheet.recordCategorySpellings([
      { spelling: 'clothe', outcome: 'Alias', target: 'Clothing', updatedAt: '2026-10-14T00:00:00.000Z' },
    ]);
    jest
      .spyOn(sheet, 'readCategorySpellings')
      .mockRejectedValue(new SpreadsheetReadError('quota exceeded'));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});
    llmParse = uniqloSuggesting('Clothes');

    const { status } = await postExpense('UNIQLO 0231 39.90');

    expect(status).toBe(200);
    expect(await writtenRows()).toEqual([['UNIQLO 0231', 'Shopping — General', 'Clothes']]);
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining('Category Spellings'),
      expect.any(SpreadsheetReadError)
    );
  });
});
