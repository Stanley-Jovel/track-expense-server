import { revalidatePath, revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { correctMerchantCategory } from '@/app/dashboard/actions';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '@/app/services/llm/types';

// The correction action builds its own spreadsheet service through the
// factory; point that at one in-memory mock the test can seed and inspect.
const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

beforeEach(async () => {
  sheet.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await sheet.appendTransaction([
    { motive: 'N1co*las Brumas N1co', amount: 18.5, type: 'Expense', category: 'Shopping — General' },
    { motive: 'Trader Joe\'s #123', amount: 42, type: 'Expense', category: 'Groceries' },
    { motive: 'N1CO*LAS BRUMAS', amount: 9.75, type: 'Expense', category: 'Shopping — General' },
    { motive: 'N1co*las Brumas N1co', amount: 22, type: 'Expense', category: 'Dining Out' },
    { motive: 'Salary', amount: 3000, type: 'Income', category: 'Transfers' },
  ]);
});

async function categoriesByMotive(): Promise<[string, string][]> {
  const rows = await sheet.readTransactions();
  return rows.map((t) => [t.motive, t.category]);
}

describe('correctMerchantCategory', () => {
  it('repairs every variant of the Merchant and reports how many rows changed', async () => {
    const result = await correctMerchantCategory('Las Brumas', 'Dining Out');

    // Two rows were wrong; the third Las Brumas row was already Dining Out.
    expect(result).toEqual({ ok: true, repaired: 2 });
    expect(await categoriesByMotive()).toEqual([
      ['N1co*las Brumas N1co', 'Dining Out'],
      ['Trader Joe\'s #123', 'Groceries'],
      ['N1CO*LAS BRUMAS', 'Dining Out'],
      ['N1co*las Brumas N1co', 'Dining Out'],
      ['Salary', 'Transfers'],
    ]);
  });

  it('leaves every column but Category exactly as logged', async () => {
    const before = await sheet.readTransactions();

    await correctMerchantCategory('Las Brumas', 'Dining Out');

    const after = await sheet.readTransactions();
    const withoutCategory = (rows: typeof before) =>
      rows.map(({ category: _category, ...rest }) => rest);
    expect(withoutCategory(after)).toEqual(withoutCategory(before));
  });

  it('busts the transactions cache and the dashboard page so the fix shows at once', async () => {
    await correctMerchantCategory('Las Brumas', 'Dining Out');

    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('reports a failed save instead of claiming success', async () => {
    sheet.setShouldFail(true);
    try {
      const result = await correctMerchantCategory('Las Brumas', 'Dining Out');
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    } finally {
      sheet.setShouldFail(false);
    }
  });

  it('remembers the correction as a Category Override for the Merchant', async () => {
    await correctMerchantCategory('Las Brumas', 'Dining Out');

    expect(await sheet.readCategoryOverrides(EXPENSE_CATEGORIES)).toEqual([
      { merchant: 'Las Brumas', category: 'Dining Out', updatedAt: expect.any(String) },
    ]);
  });

  it('replaces the earlier override and re-repairs history when corrected again', async () => {
    await correctMerchantCategory('Las Brumas', 'Dining Out');
    // Same Merchant reached through a differently-cased variant.
    const result = await correctMerchantCategory('LAS BRUMAS', 'Coffee & Quick Bites');

    expect(result).toEqual({ ok: true, repaired: 3 });
    const overrides = await sheet.readCategoryOverrides(EXPENSE_CATEGORIES);
    expect(overrides).toHaveLength(1);
    expect(overrides[0].category).toBe('Coffee & Quick Bites');
    expect(await categoriesByMotive()).toEqual([
      ['N1co*las Brumas N1co', 'Coffee & Quick Bites'],
      ['Trader Joe\'s #123', 'Groceries'],
      ['N1CO*LAS BRUMAS', 'Coffee & Quick Bites'],
      ['N1co*las Brumas N1co', 'Coffee & Quick Bites'],
      ['Salary', 'Transfers'],
    ]);
  });

  it("leaves the Merchant's Income rows (refunds) alone", async () => {
    await sheet.appendTransaction([
      { motive: 'N1co*las Brumas N1co', amount: 5, type: 'Income', category: 'Income' },
    ]);

    const result = await correctMerchantCategory('Las Brumas', 'Dining Out');

    expect(result).toEqual({ ok: true, repaired: 2 });
    const refund = (await sheet.readTransactions()).find((t) => t.type === 'Income' && t.amount === 5);
    expect(refund?.category).toBe('Income');
  });

  it('records the override even when every row already has that Category', async () => {
    const result = await correctMerchantCategory("Trader Joe's", 'Groceries');

    expect(result).toEqual({ ok: true, repaired: 0 });
    expect(await sheet.readCategoryOverrides(EXPENSE_CATEGORIES)).toEqual([
      { merchant: "Trader Joe's", category: 'Groceries', updatedAt: expect.any(String) },
    ]);
  });

  it('says the override was saved when only the history repair failed', async () => {
    jest.spyOn(sheet, 'rewriteCategories').mockRejectedValueOnce(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await correctMerchantCategory('Las Brumas', 'Dining Out');

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('for future expenses'),
    });
    expect(await sheet.readCategoryOverrides(EXPENSE_CATEGORIES)).toHaveLength(1);

    // Retrying is idempotent and finishes the repair.
    expect(await correctMerchantCategory('Las Brumas', 'Dining Out')).toEqual({
      ok: true,
      repaired: 2,
    });
  });

  it('still reports success when busting the dashboard cache fails', async () => {
    (revalidateTag as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no revalidation store');
    });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await correctMerchantCategory('Las Brumas', 'Dining Out');

    expect(result).toEqual({ ok: true, repaired: 2 });
    expect(logged).toHaveBeenCalled();
  });

  it('rejects a Category outside the fixed list and changes nothing', async () => {
    const before = await sheet.readTransactions();

    // The action is a public endpoint, so a forged request can send anything.
    const result = await correctMerchantCategory('Las Brumas', 'Brunch' as ExpenseCategory);

    expect(result).toEqual({ ok: false, error: expect.stringContaining('Brunch') });
    expect(await sheet.readTransactions()).toEqual(before);
    expect(await sheet.readCategoryOverrides(EXPENSE_CATEGORIES)).toEqual([]);
  });
});
