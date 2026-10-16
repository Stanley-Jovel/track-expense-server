import { revalidatePath, revalidateTag } from 'next/cache';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import { addTransaction, NewTransaction } from '@/app/dashboard/actions';
import type { ParsedTransaction } from '@/app/services/llm/types';

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));
jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
  revalidatePath: jest.fn(),
}));

// What the LLM "parses" when a blank Category has to be guessed, and the
// text it was given.
let llmParse: ParsedTransaction[] | Error = [];
const llmInputs: string[] = [];
jest.mock('@/app/services/llm/factory', () => ({
  LLMServiceFactory: {
    create: () => ({
      parseTransaction: async (text: string) => {
        llmInputs.push(text);
        if (llmParse instanceof Error) throw llmParse;
        return llmParse;
      },
    }),
  },
}));

const NOW = new Date('2026-10-16T21:15:30.000Z');

const cash = (overrides: Partial<NewTransaction> = {}): NewTransaction => ({
  type: 'Expense',
  motive: 'Farmers market',
  amount: 8.75,
  day: '2026-10-02',
  category: 'Groceries',
  ...overrides,
});

beforeEach(() => {
  sheet.clear();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  llmParse = [];
  llmInputs.length = 0;
  jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('addTransaction — a picked Category', () => {
  it('appends an Expense on the chosen day at the time of saving, with F blank', async () => {
    const result = await addTransaction(cash({ motive: '  Farmers market  ', amount: 8.749 }));

    expect(result).toEqual({ ok: true });
    expect(await sheet.readTransactions()).toEqual([
      {
        row: 2,
        date: new Date('2026-10-02T21:15:30.000Z'),
        motive: 'Farmers market',
        amount: 8.75,
        type: 'Expense',
        category: 'Groceries',
      },
    ]);
    expect(llmInputs).toEqual([]);
  });

  it('appends an Income', async () => {
    const result = await addTransaction(
      cash({ type: 'Income', motive: 'Freelance invoice', amount: 900, category: 'Income', day: '2026-10-16' })
    );

    expect(result).toEqual({ ok: true });
    expect(await sheet.readTransactions()).toEqual([
      expect.objectContaining({ type: 'Income', category: 'Income', amount: 900, date: new Date('2026-10-16T21:15:30.000Z') }),
    ]);
  });

  it('keeps the picked Category even when the Merchant has a Category Override', async () => {
    await sheet.upsertCategoryOverride({ merchant: 'Farmers market', category: 'Dining Out', updatedAt: '2026-10-12T00:00:00.000Z' });

    await addTransaction(cash());

    expect((await sheet.readTransactions())[0].category).toBe('Groceries');
  });

  it('busts the dashboard caches after a write', async () => {
    await addTransaction(cash());

    expect(revalidateTag).toHaveBeenCalledWith('sheet-transactions');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });

  it.each<[string, Partial<NewTransaction>]>([
    ['an empty name', { motive: '   ' }],
    ['a $0 amount', { amount: 0 }],
    ['a negative amount', { amount: -5 }],
    ['a non-number amount', { amount: Number.NaN }],
    ['a malformed day', { day: '10/02/2026' }],
    ['an impossible day', { day: '2026-02-30' }],
    ['a future day', { day: '2026-10-18' }],
    ['an unknown Category', { category: 'Pets' }],
    ['an unknown Type', { type: 'Refund' as NewTransaction['type'] }],
  ])('refuses %s and writes nothing', async (_, bad) => {
    const result = await addTransaction(cash(bad));

    expect(result).toEqual({ ok: false, error: expect.any(String) });
    expect(await sheet.readTransactions()).toEqual([]);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("allows tomorrow's UTC day, which is still today somewhere", async () => {
    expect(await addTransaction(cash({ day: '2026-10-17' }))).toEqual({ ok: true });
  });

  it('reports a failed save instead of claiming success', async () => {
    jest.spyOn(sheet, 'appendTransaction').mockRejectedValueOnce(new Error('quota'));
    jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(await addTransaction(cash())).toEqual({ ok: false, error: expect.any(String) });
  });
});

describe('addTransaction — a blank Category is chosen on save', () => {
  it("files it under the Merchant's Category Override without asking the LLM", async () => {
    await sheet.upsertCategoryOverride({ merchant: 'Farmers market', category: 'Dining Out', updatedAt: '2026-10-12T00:00:00.000Z' });

    expect(await addTransaction(cash({ category: '' }))).toEqual({ ok: true });

    expect((await sheet.readTransactions())[0].category).toBe('Dining Out');
    expect(llmInputs).toEqual([]);
  });

  it("otherwise takes the LLM's Category and suggestion, keeping the entry's own fields", async () => {
    llmParse = [
      { motive: 'farmers mkt', amount: 1, type: 'Income', category: 'Shopping — General', suggestedCategory: 'Produce Stand' },
    ];

    expect(await addTransaction(cash({ category: '' }))).toEqual({ ok: true });

    expect(llmInputs).toEqual(['Expense: Farmers market $8.75']);
    expect(await sheet.readTransactions()).toEqual([
      {
        row: 2,
        date: new Date('2026-10-02T21:15:30.000Z'),
        motive: 'Farmers market',
        amount: 8.75,
        type: 'Expense',
        category: 'Shopping — General',
        suggestedCategory: 'Produce Stand',
      },
    ]);
  });

  it('runs the suggestion through the spelling checks', async () => {
    // "Grocery" is just a respelling of Groceries: filed there, F blank.
    llmParse = [{ motive: 'x', amount: 1, type: 'Expense', category: 'Shopping — General', suggestedCategory: 'Grocery' }];

    await addTransaction(cash({ category: '' }));

    const [row] = await sheet.readTransactions();
    expect(row.category).toBe('Groceries');
    expect(row.suggestedCategory).toBeUndefined();
  });

  it('never gives a blank Income a suggestion', async () => {
    llmParse = [{ motive: 'x', amount: 1, type: 'Income', category: 'Income', suggestedCategory: 'Side Gigs' }];

    await addTransaction(cash({ type: 'Income', motive: 'Freelance invoice', category: '' }));

    const [row] = await sheet.readTransactions();
    expect(row.category).toBe('Income');
    expect(row.suggestedCategory).toBeUndefined();
  });

  it('saves nothing when the LLM fails, and asks for a Category', async () => {
    llmParse = new Error('every provider failed');
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await addTransaction(cash({ category: '' }));

    expect(result).toEqual({ ok: false, error: "Couldn't guess a category. Pick one or try again." });
    expect(await sheet.readTransactions()).toEqual([]);
  });

  it('saves nothing when the LLM returns no transaction', async () => {
    llmParse = [];
    jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await addTransaction(cash({ category: '' }));

    expect(result).toEqual({ ok: false, error: "Couldn't guess a category. Pick one or try again." });
    expect(await sheet.readTransactions()).toEqual([]);
  });
});
