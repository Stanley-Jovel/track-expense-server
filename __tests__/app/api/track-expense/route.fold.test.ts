import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { type ParsedTransaction } from '@/app/services/llm/types';

jest.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// A folded spelling at the POST /api/track-expense seam: a suggestion whose
// spelling was folded into a waiting Suggestion joins that Suggestion.

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

beforeEach(() => {
  sheet.clear();
});

describe('POST /api/track-expense — folded spellings', () => {
  it("writes the waiting Suggestion's label to F for a spelling folded into it", async () => {
    await sheet.recordCategorySpellings([
      { spelling: 'fuel', outcome: 'Alias', target: 'Gas & Fuel', updatedAt: '2026-10-14T00:00:00.000Z' },
    ]);
    llmParse = [
      { motive: 'Chevron 0391', amount: 48, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'fuels' },
    ];

    const res = await POST(
      new Request('http://localhost/api/track-expense', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transaction: 'Chevron 0391 48' }),
      })
    );

    expect(res.status).toBe(200);
    expect((await sheet.readTransactions()).map((t) => [t.motive, t.category, t.suggestedCategory])).toEqual([
      ['Chevron 0391', 'Local Transportation', 'Gas & Fuel'],
    ]);
  });
});
