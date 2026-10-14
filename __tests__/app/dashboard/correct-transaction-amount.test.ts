import { revalidatePath, revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { correctTransactionAmount } from '@/app/dashboard/actions';

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

const DOLLARCITY = 'Dollarcity, Opico, La Libertad';

beforeEach(async () => {
  sheet.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  await sheet.appendTransaction([
    { motive: 'Trader Joe\'s #123', amount: 42, type: 'Expense', category: 'Groceries' },
    // Row 3: logged as $0 by a bad parse.
    { motive: DOLLARCITY, amount: 0, type: 'Expense', category: 'Shopping — General' },
  ]);
});

describe('correctTransactionAmount', () => {
  it("rewrites that row's amount and leaves every other cell alone", async () => {
    const before = await sheet.readTransactions();

    const result = await correctTransactionAmount(3, DOLLARCITY, 0, 1.5);

    expect(result).toEqual({ ok: true, amount: 1.5 });
    const after = await sheet.readTransactions();
    expect(after[1]).toEqual({ ...before[1], amount: 1.5 });
    expect(after[0]).toEqual(before[0]);
  });

  it('rounds to cents', async () => {
    expect(await correctTransactionAmount(3, DOLLARCITY, 0, 1.499)).toEqual({ ok: true, amount: 1.5 });
  });

  it('busts the dashboard caches after a write', async () => {
    await correctTransactionAmount(3, DOLLARCITY, 0, 1.5);

    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it.each([0, -3, NaN, Infinity])('rejects an amount of %p and changes nothing', async (amount) => {
    const before = await sheet.readTransactions();

    const result = await correctTransactionAmount(3, DOLLARCITY, 0, amount);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await sheet.readTransactions()).toEqual(before);
  });

  it('refuses to write when the row no longer matches what the dashboard showed', async () => {
    const before = await sheet.readTransactions();

    // Wrong motive, wrong previous amount, and a row that doesn't exist.
    for (const [row, motive, previous] of [
      [3, 'Something else', 0],
      [3, DOLLARCITY, 9],
      [99, DOLLARCITY, 0],
      [1, 'Motive', 0],
    ] as const) {
      const result = await correctTransactionAmount(row, motive, previous, 1.5);
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    }
    expect(await sheet.readTransactions()).toEqual(before);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('reports a failed save instead of claiming success', async () => {
    jest.spyOn(sheet, 'rewriteAmount').mockRejectedValueOnce(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await correctTransactionAmount(3, DOLLARCITY, 0, 1.5);

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });
});
