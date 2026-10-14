import { revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { listSuggestions } from '@/app/dashboard/suggestions';
import { approveSuggestion, foldSuggestion } from '@/app/dashboard/suggestion-actions';
import type { CategorySuggestion } from '@/app/services/categories/open-categories';

// The review seam for two waiting Suggestions that mean the same thing: the
// listing function's Suggestion look-alike hint, the Fold server action, and
// Approve after a fold, against the mock spreadsheet service.

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
    { motive: 'Shell 7781', amount: 52, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'Gas & Fuel' },
    { motive: 'Chevron 0391', amount: 48, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'Fuel' },
    { motive: 'Trupanion', amount: 49, type: 'Expense', category: 'Insurance', suggestedCategory: 'Pet Insurance' },
    { motive: 'Rover 2210', amount: 30, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Pets' },
    { motive: 'Arco 18', amount: 40, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'fuels' },
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

describe('listSuggestions — Suggestion look-alike hints', () => {
  it('hints another waiting Suggestion a Suggestion looks like', async () => {
    expect((await suggestion('Fuel')).hint).toEqual({
      kind: 'suggestion',
      key: 'gas and fuel',
      label: 'Gas & Fuel',
    });
  });

  it('hints "Gas & Fuel" for "Car Fuel": one of the two words each has is shared', async () => {
    await sheet.appendTransaction([
      { motive: 'Chevron 0412', amount: 45, type: 'Expense', category: 'Local Transportation', suggestedCategory: 'Car Fuel' },
    ]);

    expect((await suggestion('Car Fuel')).hint).toEqual({
      kind: 'suggestion',
      key: 'gas and fuel',
      label: 'Gas & Fuel',
    });
  });

  it('hints the Category when a Category and a Suggestion tie', async () => {
    // "Pet Insurance" shares half its words with Insurance and with Pets.
    expect((await suggestion('Pet Insurance')).hint).toEqual({ kind: 'category', name: 'Insurance' });
  });
});

describe('foldSuggestion', () => {
  it("rewrites the folded rows' F to the target's label and records the spelling as its Alias", async () => {
    const fuel = await suggestion('Fuel');

    const result = await foldSuggestion({ ...fuel, into: 'Gas & Fuel' });

    expect(result).toEqual({ ok: true, moved: 2, skipped: 0 });
    expect(await writtenRows()).toEqual([
      ['Shell 7781', 'Local Transportation', 'Gas & Fuel'],
      ['Chevron 0391', 'Local Transportation', 'Gas & Fuel'],
      ['Trupanion', 'Insurance', 'Pet Insurance'],
      ['Rover 2210', 'Shopping — General', 'Pets'],
      ['Arco 18', 'Local Transportation', 'Gas & Fuel'],
    ]);
    expect(await sheet.readCategorySpellings()).toEqual([
      { spelling: 'fuel', outcome: 'Alias', target: 'Gas & Fuel', updatedAt: expect.any(String) },
    ]);
    const gas = await suggestion('Gas & Fuel');
    expect(gas.entries.map((e) => e.motive)).toEqual(['Shell 7781', 'Chevron 0391', 'Arco 18']);
    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
  });

  it('skips rows that changed since the Suggestion was listed', async () => {
    const fuel = await suggestion('Fuel');
    await sheet.rewriteTransaction(6, {
      date: new Date(),
      motive: 'Arco 18',
      amount: 41,
      category: 'Local Transportation',
    });

    const result = await foldSuggestion({ ...fuel, into: 'Gas & Fuel' });

    expect(result).toEqual({ ok: true, moved: 1, skipped: 1 });
    expect((await writtenRows())[4]).toEqual(['Arco 18', 'Local Transportation', 'fuels']);
  });

  it('refuses a target that is not a waiting Suggestion, writing nothing', async () => {
    const fuel = await suggestion('Fuel');

    for (const into of ['Car Fuel', 'Insurance', 'fuel']) {
      const result = await foldSuggestion({ ...fuel, into });
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    }
    expect((await writtenRows())[1]).toEqual(['Chevron 0391', 'Local Transportation', 'Fuel']);
    expect(await sheet.readCategorySpellings()).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe('a fold followed by Approve under a new name', () => {
  it('moves every entry and leaves every spelling pointing at the new Category', async () => {
    await foldSuggestion({ ...(await suggestion('Fuel')), into: 'Gas & Fuel' });

    const result = await approveSuggestion({
      ...(await suggestion('Gas & Fuel')),
      name: 'Car Fuel',
      countsAsSpending: true,
    });

    expect(result).toEqual({ ok: true, moved: 3, skipped: 0 });
    expect(await writtenRows()).toEqual([
      ['Shell 7781', 'Car Fuel', undefined],
      ['Chevron 0391', 'Car Fuel', undefined],
      ['Trupanion', 'Insurance', 'Pet Insurance'],
      ['Rover 2210', 'Shopping — General', 'Pets'],
      ['Arco 18', 'Car Fuel', undefined],
    ]);
    expect(await sheet.readCategorySpellings()).toEqual([
      { spelling: 'fuel', outcome: 'Alias', target: 'Car Fuel', updatedAt: expect.any(String) },
      { spelling: 'gas and fuel', outcome: 'Alias', target: 'Car Fuel', updatedAt: expect.any(String) },
    ]);
  });
});
