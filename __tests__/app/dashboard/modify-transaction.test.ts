import { revalidatePath, revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { modifyTransaction, TransactionEdit } from '@/app/dashboard/actions';

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

const DOLLARCITY = 'Dollarcity, Opico, La Libertad';
const LOGGED_AT = new Date('2026-10-09T14:30:00.000Z');

beforeEach(async () => {
  sheet.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  jest.useFakeTimers({ now: LOGGED_AT, doNotFake: ['nextTick', 'setImmediate'] });
  await sheet.appendTransaction([
    { motive: 'N1co*las Brumas N1co', amount: 18.5, type: 'Expense', category: 'Shopping — General' },
    // Row 3: logged as $0 by a bad parse.
    { motive: DOLLARCITY, amount: 0, type: 'Expense', category: 'Shopping — General' },
    { motive: 'N1CO*LAS BRUMAS', amount: 9.75, type: 'Expense', category: 'Shopping — General' },
    { motive: 'Salary', amount: 3000, type: 'Income', category: 'Income' },
  ]);
  jest.useRealTimers();
});

const unchanged = (t: { motive: string; category: string; amount: number }): TransactionEdit => ({
  motive: t.motive,
  category: t.category,
  amount: t.amount,
  day: '2026-10-09',
  allFromMerchant: false,
});

describe('modifyTransaction', () => {
  it('rewrites name, Category, amount and date of that row only, keeping its time and Type', async () => {
    const before = await sheet.readTransactions();

    const result = await modifyTransaction(3, DOLLARCITY, 0, {
      motive: '  Dollar City  ',
      category: 'Groceries',
      amount: 1.499,
      day: '2026-10-07',
      allFromMerchant: false,
    });

    expect(result).toEqual({ ok: true });
    const after = await sheet.readTransactions();
    expect(after[1]).toEqual({
      ...before[1],
      motive: 'Dollar City',
      category: 'Groceries',
      amount: 1.5,
      date: new Date('2026-10-07T14:30:00.000Z'),
    });
    expect([after[0], after[2], after[3]]).toEqual([before[0], before[2], before[3]]);
    expect(await sheet.readCategoryOverrides()).toEqual([]);
  });

  it('busts the dashboard caches after a write', async () => {
    await modifyTransaction(3, DOLLARCITY, 0, { ...unchanged({ motive: DOLLARCITY, category: 'Groceries', amount: 1.5 }) });

    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it("with allFromMerchant, saves a Category Override and repairs the Merchant's other rows", async () => {
    const result = await modifyTransaction(2, 'N1co*las Brumas N1co', 18.5, {
      ...unchanged({ motive: 'N1co*las Brumas N1co', category: 'Dining Out', amount: 18.5 }),
      allFromMerchant: true,
    });

    expect(result).toEqual({ ok: true });
    const categories = (await sheet.readTransactions()).map((t) => t.category);
    expect(categories).toEqual(['Dining Out', 'Shopping — General', 'Dining Out', 'Income']);
    expect(await sheet.readCategoryOverrides()).toEqual([
      expect.objectContaining({ merchant: 'Las Brumas', category: 'Dining Out' }),
    ]);
  });

  it('never saves an override from an Income entry', async () => {
    const result = await modifyTransaction(5, 'Salary', 3000, {
      ...unchanged({ motive: 'Salary', category: 'Transfers', amount: 3000 }),
      allFromMerchant: true,
    });

    expect(result).toEqual({ ok: true });
    expect(await sheet.readCategoryOverrides()).toEqual([]);
  });

  it.each<[string, Partial<TransactionEdit>]>([
    ['an empty name', { motive: '   ' }],
    ['a $0 amount', { amount: 0 }],
    ['a negative amount', { amount: -3 }],
    ['a NaN amount', { amount: NaN }],
    ['a malformed date', { day: '10/07/2026' }],
    ['an impossible date', { day: '2026-02-30' }],
    ['an unknown Category', { category: 'Snacks' }],
  ])('rejects %s and changes nothing', async (_, patch) => {
    const before = await sheet.readTransactions();

    const result = await modifyTransaction(3, DOLLARCITY, 0, {
      ...unchanged({ motive: DOLLARCITY, category: 'Groceries', amount: 1.5 }),
      ...patch,
    });

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await sheet.readTransactions()).toEqual(before);
  });

  it('refuses to write when the row no longer matches what the dashboard showed', async () => {
    const before = await sheet.readTransactions();
    const edit = unchanged({ motive: DOLLARCITY, category: 'Groceries', amount: 1.5 });

    for (const [row, motive, amount] of [
      [3, 'Something else', 0],
      [3, DOLLARCITY, 9],
      [99, DOLLARCITY, 0],
      [1, 'Motive', 0],
    ] as const) {
      const result = await modifyTransaction(row, motive, amount, edit);
      expect(result).toEqual({ ok: false, error: expect.any(String) });
    }
    expect(await sheet.readTransactions()).toEqual(before);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('reports a failed save instead of claiming success', async () => {
    jest.spyOn(sheet, 'rewriteTransaction').mockRejectedValueOnce(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await modifyTransaction(3, DOLLARCITY, 0, unchanged({ motive: DOLLARCITY, category: 'Groceries', amount: 1.5 }));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
  });
});
