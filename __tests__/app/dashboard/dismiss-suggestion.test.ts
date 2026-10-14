import { revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { listSuggestions } from '@/app/dashboard/suggestions';
import { dismissSuggestion } from '@/app/dashboard/suggestion-actions';
import type { CategorySuggestion } from '@/app/services/categories/open-categories';

// The review seam for "Not a category": the Dismiss server action, against
// the mock spreadsheet service.

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));
jest.mock('next/cache', () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

beforeEach(async () => {
  sheet.clear();
  jest.clearAllMocks();
  await sheet.appendTransaction([
    { motive: 'Venmo', amount: 20, type: 'Expense', category: 'Transfers', suggestedCategory: 'Misc Stuff' },
    { motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' },
    { motive: 'Venmo', amount: 15, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'misc stuff' },
    { motive: 'PetSmart 1123', amount: 42, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Pet Supplies' },
  ]);
});

/** [Motive, Category, Suggested Category] of every row in the sheet. */
async function writtenRows(): Promise<[string, string, string | undefined][]> {
  return (await sheet.readTransactions()).map((t) => [t.motive, t.category, t.suggestedCategory]);
}

async function suggestion(label: string): Promise<CategorySuggestion> {
  const found = (await listSuggestions()).find((s) => s.label === label);
  if (!found) throw new Error(`No Suggestion "${label}"`);
  return found;
}

describe('dismissSuggestion', () => {
  it('clears F, keeps each Category and records the spelling as Dismissed', async () => {
    const misc = await suggestion('Misc Stuff');

    const result = await dismissSuggestion(misc);

    expect(result).toEqual({ ok: true, moved: 2, skipped: 0 });
    expect(await writtenRows()).toEqual([
      ['Venmo', 'Transfers', undefined],
      ['Starbucks 20088', 'Coffee & Quick Bites', undefined],
      ['Venmo', 'Shopping — General', undefined],
      ['PetSmart 1123', 'Shopping — General', 'Pet Supplies'],
    ]);
    expect(await sheet.readCategorySpellings()).toEqual([
      { spelling: 'misc stuff', outcome: 'Dismissed', target: '', updatedAt: expect.any(String) },
    ]);
    expect((await listSuggestions()).map((s) => s.label)).toEqual(['Pet Supplies']);
    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
  });

  it('skips rows that changed since the Suggestion was listed', async () => {
    const misc = await suggestion('Misc Stuff');
    await sheet.rewriteTransaction(4, {
      date: new Date(),
      motive: 'Venmo',
      amount: 18,
      category: 'Shopping — General',
    });

    const result = await dismissSuggestion(misc);

    expect(result).toEqual({ ok: true, moved: 1, skipped: 1 });
    expect((await writtenRows())[2]).toEqual(['Venmo', 'Shopping — General', 'misc stuff']);
  });

  it('refuses an unknown suggestion, writing nothing', async () => {
    const result = await dismissSuggestion({ key: '', entries: [] });

    expect(result).toEqual({ ok: false, error: 'Unknown suggestion.' });
    expect(await sheet.readCategorySpellings()).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("shows a failure when the sheet can't be written", async () => {
    const misc = await suggestion('Misc Stuff');
    sheet.setShouldFail(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await dismissSuggestion(misc);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });
});
