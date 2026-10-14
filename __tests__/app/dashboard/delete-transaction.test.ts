import { revalidatePath, revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { deleteTransaction, modifyTransaction } from '@/app/dashboard/actions';

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
    { motive: 'Super Selectos', amount: 23.4, type: 'Expense', category: 'Groceries' },
    { motive: 'Test Candies', amount: 9.99, type: 'Expense', category: 'Groceries' },
    { motive: 'Uber Trip', amount: 6.2, type: 'Expense', category: 'Local Transportation' },
  ]);
});

const motives = async () => (await sheet.readTransactions()).map((t) => [t.row, t.motive]);

describe('deleteTransaction', () => {
  it('removes that row and shifts the later rows up', async () => {
    expect(await deleteTransaction(3, 'Test Candies', 9.99)).toEqual({ ok: true });

    expect(await motives()).toEqual([
      [2, 'Super Selectos'],
      [3, 'Uber Trip'],
    ]);
    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it('refuses to delete when the row no longer matches what the dashboard showed', async () => {
    for (const [row, motive, amount] of [
      [3, 'Uber Trip', 9.99],
      [3, 'Test Candies', 1],
      [99, 'Test Candies', 9.99],
      [1, 'Datetime', 0],
      [2.5, 'Test Candies', 9.99],
    ] as const) {
      expect(await deleteTransaction(row, motive, amount)).toEqual({
        ok: false,
        error: expect.any(String),
      });
    }
    expect(await sheet.readTransactions()).toHaveLength(3);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('a stale page cannot delete or edit the row that shifted into place', async () => {
    // Page loaded with Test Candies at row 3 and Uber Trip at row 4.
    await deleteTransaction(3, 'Test Candies', 9.99);

    // A second tap from the same stale page still targets row 3 (now Uber Trip).
    expect((await deleteTransaction(3, 'Test Candies', 9.99)).ok).toBe(false);
    expect(
      (
        await modifyTransaction(4, 'Uber Trip', 6.2, {
          motive: 'Uber Trip',
          category: 'Local Transportation',
          amount: 7,
          day: '2026-10-09',
          allFromMerchant: false,
        })
      ).ok
    ).toBe(false);
    expect(await motives()).toEqual([
      [2, 'Super Selectos'],
      [3, 'Uber Trip'],
    ]);
  });

  it('reports a failed delete instead of claiming success', async () => {
    jest.spyOn(sheet, 'deleteTransactionRow').mockRejectedValueOnce(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await deleteTransaction(3, 'Test Candies', 9.99)).toEqual({
      ok: false,
      error: expect.any(String),
    });
    expect(await sheet.readTransactions()).toHaveLength(3);
  });
});
