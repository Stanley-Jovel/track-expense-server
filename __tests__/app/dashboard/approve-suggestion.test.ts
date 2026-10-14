import { revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { listSuggestions } from '@/app/dashboard/suggestions';
import { approveSuggestion } from '@/app/dashboard/suggestion-actions';
import type { CategorySuggestion } from '@/app/services/categories/open-categories';

// The review seam: the listing function and the Approve server action,
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
    { motive: 'PETSMART #0412', amount: 38.5, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Pet Supplies' },
    { motive: 'Starbucks 20088', amount: 7, type: 'Expense', category: 'Coffee & Quick Bites' },
    { motive: 'Shell Oil 5741', amount: 41.1, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'Gas & Fuel' },
    { motive: 'Chewy.com', amount: 54.25, type: 'Expense', category: 'Groceries', suggestedCategory: 'pet supply' },
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

describe('listSuggestions', () => {
  it('lists each waiting Suggestion once, with its first-seen label, entries and total', async () => {
    expect(await listSuggestions()).toEqual([
      {
        key: expect.any(String),
        label: 'Pet Supplies',
        total: 92.75,
        entries: [
          { row: 2, motive: 'PETSMART #0412', amount: 38.5, category: 'Shopping — General', suggestedCategory: 'Pet Supplies' },
          { row: 5, motive: 'Chewy.com', amount: 54.25, category: 'Groceries', suggestedCategory: 'pet supply' },
        ],
      },
      {
        key: expect.any(String),
        label: 'Gas & Fuel',
        total: 41.1,
        entries: [
          { row: 4, motive: 'Shell Oil 5741', amount: 41.1, category: 'Local Transportation', suggestedCategory: 'Gas & Fuel' },
        ],
      },
    ]);
  });
});

describe('approveSuggestion', () => {
  it("adds the Category, moves the Suggestion's entries into it and clears F", async () => {
    const pets = await suggestion('Pet Supplies');

    const result = await approveSuggestion({ ...pets, name: 'Pet Supplies', countsAsSpending: true });

    expect(result).toEqual({ ok: true, moved: 2, skipped: 0 });
    expect(await sheet.readCategories()).toContainEqual({ name: 'Pet Supplies', countsAsSpending: true });
    expect(await writtenRows()).toEqual([
      ['PETSMART #0412', 'Pet Supplies', undefined],
      ['Starbucks 20088', 'Coffee & Quick Bites', undefined],
      ['Shell Oil 5741', 'Local Transportation', 'Gas & Fuel'],
      ['Chewy.com', 'Pet Supplies', undefined],
    ]);
    expect((await listSuggestions()).map((s) => s.label)).toEqual(['Gas & Fuel']);
    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
  });

  it('approves under a new name as Money Movement', async () => {
    const fuel = await suggestion('Gas & Fuel');

    const result = await approveSuggestion({ ...fuel, name: '  Car  Fuel ', countsAsSpending: false });

    expect(result).toEqual({ ok: true, moved: 1, skipped: 0 });
    expect(await sheet.readCategories()).toContainEqual({ name: 'Car Fuel', countsAsSpending: false });
    expect((await writtenRows())[2]).toEqual(['Shell Oil 5741', 'Car Fuel', undefined]);
  });

  it('refuses a name that is a spelling of a Category on the list, writing nothing', async () => {
    const pets = await suggestion('Pet Supplies');

    const result = await approveSuggestion({ ...pets, name: 'coffee and quick bite', countsAsSpending: true });

    expect(result).toEqual({ ok: false, error: expect.stringContaining('Coffee & Quick Bites') });
    expect(await sheet.readCategories()).not.toContainEqual(
      expect.objectContaining({ name: 'coffee and quick bite' })
    );
    expect((await listSuggestions()).map((s) => s.label)).toEqual(['Pet Supplies', 'Gas & Fuel']);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('skips rows that changed or were deleted since the Suggestion was listed', async () => {
    const pets = await suggestion('Pet Supplies');
    // Since the deck loaded: PetSmart's amount was modified, and the
    // Starbucks row above Chewy was deleted, shifting Chewy up one row.
    await sheet.rewriteTransaction(2, {
      date: new Date(),
      motive: 'PETSMART #0412',
      amount: 40,
      category: 'Shopping — General',
    });
    await sheet.deleteTransactionRow(3);

    const result = await approveSuggestion({ ...pets, name: 'Pet Supplies', countsAsSpending: true });

    expect(result).toEqual({ ok: true, moved: 0, skipped: 2 });
    expect(await writtenRows()).toEqual([
      ['PETSMART #0412', 'Shopping — General', 'Pet Supplies'],
      ['Shell Oil 5741', 'Local Transportation', 'Gas & Fuel'],
      ['Chewy.com', 'Groceries', 'pet supply'],
    ]);
  });

  it("shows a failure and adds nothing when the sheet can't be written", async () => {
    const pets = await suggestion('Pet Supplies');
    sheet.setShouldFail(true);
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await approveSuggestion({ ...pets, name: 'Pet Supplies', countsAsSpending: true });

    sheet.setShouldFail(false);
    expect(result).toEqual({ ok: false, error: "Couldn't add Pet Supplies. Try again." });
    expect(await sheet.readCategories()).not.toContainEqual(
      expect.objectContaining({ name: 'Pet Supplies' })
    );
  });
});
