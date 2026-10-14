import { revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { listSuggestions } from '@/app/dashboard/suggestions';
import { mergeSuggestion } from '@/app/dashboard/suggestion-actions';
import type { CategorySuggestion } from '@/app/services/categories/open-categories';

// The review seam for Suggestions that mean a Category the user already has:
// the listing function's look-alike hint, and the Merge server action,
// against the mock spreadsheet service.

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
    { motive: 'UNIQLO 0231', amount: 39.9, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Clothes' },
    { motive: 'Trupanion', amount: 49, type: 'Expense', category: 'Insurance', suggestedCategory: 'Pet Insurance' },
    { motive: 'Staples 112', amount: 22.4, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Home Office Supplies' },
    { motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' },
    { motive: 'H&M 0042', amount: 25, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'clothes' },
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

describe('listSuggestions — look-alike hints', () => {
  it('hints the Category a Suggestion looks like', async () => {
    expect((await suggestion('Clothes')).hint).toEqual({ kind: 'category', name: 'Clothing' });
  });

  it('hints a Category sharing half the words, without applying it', async () => {
    expect((await suggestion('Pet Insurance')).hint).toEqual({ kind: 'category', name: 'Insurance' });
    expect((await writtenRows())[1]).toEqual(['Trupanion', 'Insurance', 'Pet Insurance']);
  });

  it('gives no hint below 50% of words in common', async () => {
    // Shares "home" with Home Maintenance & Furnishings: 1 word of 5.
    expect((await suggestion('Home Office Supplies')).hint).toBeUndefined();
  });
});

describe('mergeSuggestion', () => {
  it("moves the Suggestion's entries into the Category, clears F and records the spelling as its Alias", async () => {
    const clothes = await suggestion('Clothes');

    const result = await mergeSuggestion({ ...clothes, into: 'Clothing' });

    expect(result).toEqual({ ok: true, moved: 2, skipped: 0 });
    expect(await writtenRows()).toEqual([
      ['UNIQLO 0231', 'Clothing', undefined],
      ['Trupanion', 'Insurance', 'Pet Insurance'],
      ['Staples 112', 'Shopping — General', 'Home Office Supplies'],
      ['Starbucks 20088', 'Coffee & Quick Bites', undefined],
      ['H&M 0042', 'Clothing', undefined],
    ]);
    expect(await sheet.readCategorySpellings()).toEqual([
      { spelling: 'clothe', outcome: 'Alias', target: 'Clothing', updatedAt: expect.any(String) },
    ]);
    expect((await listSuggestions()).map((s) => s.label)).toEqual(['Pet Insurance', 'Home Office Supplies']);
    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
  });

  it('merges a Suggestion with no hint into any Category', async () => {
    const office = await suggestion('Home Office Supplies');

    const result = await mergeSuggestion({ ...office, into: 'Home Maintenance & Furnishings' });

    expect(result).toEqual({ ok: true, moved: 1, skipped: 0 });
    expect((await writtenRows())[2]).toEqual(['Staples 112', 'Home Maintenance & Furnishings', undefined]);
  });

  it('skips rows that changed since the Suggestion was listed', async () => {
    const clothes = await suggestion('Clothes');
    await sheet.rewriteTransaction(6, {
      date: new Date(),
      motive: 'H&M 0042',
      amount: 30,
      category: 'Shopping — General',
    });

    const result = await mergeSuggestion({ ...clothes, into: 'Clothing' });

    expect(result).toEqual({ ok: true, moved: 1, skipped: 1 });
    expect((await writtenRows())[4]).toEqual(['H&M 0042', 'Shopping — General', 'clothes']);
  });

  it('refuses a Category that is not on the list, writing nothing', async () => {
    const clothes = await suggestion('Clothes');

    const result = await mergeSuggestion({ ...clothes, into: 'Apparel' });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('Apparel') });
    expect((await writtenRows())[0]).toEqual(['UNIQLO 0231', 'Shopping — General', 'Clothes']);
    expect(await sheet.readCategorySpellings()).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("shows a failure when the sheet can't be written", async () => {
    const clothes = await suggestion('Clothes');
    sheet.setShouldFail(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await mergeSuggestion({ ...clothes, into: 'Clothing' });

    sheet.setShouldFail(false);
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Clothing') });
  });
});
