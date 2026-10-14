import { GoogleSheetsService } from '@/app/services/spreadsheet/google-sheets-service';
import { EXPENSE_CATEGORIES } from '@/app/services/llm/types';

// The real GoogleSheetsService against a stubbed `sheets` client: proves which
// ranges it reads and writes without touching any real spreadsheet.
const mockSheets = {
  spreadsheets: {
    get: jest.fn(),
    batchUpdate: jest.fn(),
    values: {
      get: jest.fn(),
      update: jest.fn(),
      append: jest.fn(),
      batchUpdate: jest.fn(),
    },
  },
};
jest.mock('googleapis', () => ({ google: { sheets: () => mockSheets } }));

const api = mockSheets.spreadsheets;
// jest.setup.ts points the Transactions sheet name at 'Test'.
const TX = 'Test';

function sheetTitles(...titles: string[]) {
  api.get.mockResolvedValue({
    data: { sheets: titles.map((title) => ({ properties: { title } })) },
  });
}

function overrideRows(range: string, values: unknown[][]) {
  api.values.get.mockResolvedValue({ data: { range, values } });
}

const ranges = (mock: jest.Mock) => mock.mock.calls.map(([req]) => req.range);

let service: GoogleSheetsService;

beforeEach(() => {
  jest.resetAllMocks();
  process.env.GOOGLE_SHEETS_CLIENT_EMAIL ||= 'test@example.com';
  process.env.GOOGLE_SHEETS_PRIVATE_KEY ||= 'not-a-real-key';
  process.env.GOOGLE_SHEETS_SPREADSHEET_ID ||= 'spreadsheet-id';
  service = new GoogleSheetsService();
});

describe('rewriteCategories', () => {
  it('writes only the single Category cell of each row', async () => {
    await service.rewriteCategories([
      { row: 3, category: 'Dining Out' },
      { row: 117, category: 'Dining Out' },
    ]);

    expect(api.values.batchUpdate).toHaveBeenCalledTimes(1);
    const [{ requestBody }] = api.values.batchUpdate.mock.calls[0];
    expect(requestBody.data).toEqual([
      { range: `${TX}!E3`, values: [['Dining Out']] },
      { range: `${TX}!E117`, values: [['Dining Out']] },
    ]);
  });

  it('makes no call when there is nothing to rewrite', async () => {
    await service.rewriteCategories([]);

    expect(api.values.batchUpdate).not.toHaveBeenCalled();
  });
});

describe('rewriteTransaction', () => {
  it('writes date, Motive, amount and Category of the row, never its Type', async () => {
    await service.rewriteTransaction(42, {
      date: new Date('2026-10-09T14:30:00.000Z'),
      motive: 'Las Brumas',
      amount: 1.5,
      category: 'Dining Out',
    });

    expect(api.values.batchUpdate).toHaveBeenCalledTimes(1);
    const [{ requestBody }] = api.values.batchUpdate.mock.calls[0];
    expect(requestBody.valueInputOption).toBe('RAW');
    expect(requestBody.data).toEqual([
      // 2026-10-09 is serial 46304; 14:30 is 0.6041666… of a day.
      { range: `${TX}!A42:C42`, values: [[46304 + 14.5 / 24, 'Las Brumas', 1.5]] },
      { range: `${TX}!E42`, values: [['Dining Out']] },
    ]);
  });
});

describe('deleteTransactionRow', () => {
  it('deletes exactly that sheet row of the Transactions sheet, by its numeric id', async () => {
    api.get.mockResolvedValue({
      data: {
        sheets: [
          { properties: { title: 'Analysis', sheetId: 11 } },
          { properties: { title: TX, sheetId: 42 } },
        ],
      },
    });

    await service.deleteTransactionRow(7);

    expect(api.batchUpdate).toHaveBeenCalledTimes(1);
    const [{ requestBody }] = api.batchUpdate.mock.calls[0];
    expect(requestBody.requests).toEqual([
      {
        deleteDimension: {
          range: { sheetId: 42, dimension: 'ROWS', startIndex: 6, endIndex: 7 },
        },
      },
    ]);
  });

  it('deletes nothing when the Transactions sheet is missing', async () => {
    sheetTitles('Analysis');

    await expect(service.deleteTransactionRow(7)).rejects.toThrow();
    expect(api.batchUpdate).not.toHaveBeenCalled();
  });
});

describe('readTransactions', () => {
  it('numbers rows from the range the API reports, not an assumed A2', async () => {
    api.values.get.mockResolvedValue({
      data: {
        range: `${TX}!A5:E6`,
        values: [
          [46000, 'Uber trip', 15, 'Expense', 'Local Transportation'],
          [46001, 'Starbucks', 7, 'Expense', 'Coffee & Quick Bites'],
        ],
      },
    });

    const rows = await service.readTransactions();

    expect(rows.map((t) => [t.motive, t.row])).toEqual([
      ['Uber trip', 5],
      ['Starbucks', 6],
    ]);
  });

  it('falls back to A2 when the response carries no range', async () => {
    api.values.get.mockResolvedValue({
      data: { values: [[46000, 'Uber trip', 15, 'Expense', 'Local Transportation']] },
    });

    const rows = await service.readTransactions();

    expect(rows.map((t) => t.row)).toEqual([2]);
  });
});

describe('upsertCategoryOverride', () => {
  const override = {
    merchant: 'LAS BRUMAS',
    category: 'Dining Out' as const,
    updatedAt: '2026-10-12T00:00:00.000Z',
  };

  it("updates the existing Merchant's row, offset past the header", async () => {
    sheetTitles(TX, 'CategoryOverrides');
    overrideRows('CategoryOverrides!A2:C3', [
      ['Starbucks', 'Coffee & Quick Bites', 'x'],
      ['Las Brumas', 'Shopping — General', 'y'],
    ]);

    await service.upsertCategoryOverride(override);

    expect(ranges(api.values.update)).toEqual(['CategoryOverrides!A3:C3']);
    expect(api.values.update.mock.calls[0][0].requestBody.values).toEqual([
      ['LAS BRUMAS', 'Dining Out', '2026-10-12T00:00:00.000Z'],
    ]);
    expect(api.values.append).not.toHaveBeenCalled();
    expect(api.batchUpdate).not.toHaveBeenCalled();
  });

  it('appends a Merchant that has no override yet', async () => {
    sheetTitles(TX, 'CategoryOverrides');
    overrideRows('CategoryOverrides!A2:C2', [['Starbucks', 'Coffee & Quick Bites', 'x']]);

    await service.upsertCategoryOverride(override);

    expect(ranges(api.values.append)).toEqual(['CategoryOverrides!A:C']);
    expect(api.values.update).not.toHaveBeenCalled();
  });

  it('creates the CategoryOverrides sheet, with its header, when it is missing', async () => {
    sheetTitles(TX);

    await service.upsertCategoryOverride(override);

    expect(api.batchUpdate.mock.calls[0][0].requestBody.requests).toEqual([
      { addSheet: { properties: { title: 'CategoryOverrides' } } },
    ]);
    expect(ranges(api.values.update)).toEqual(['CategoryOverrides!A1:C1']);
    expect(ranges(api.values.append)).toEqual(['CategoryOverrides!A:C']);
    expect(api.values.get).not.toHaveBeenCalled();
  });
});

describe('readCategoryOverrides', () => {
  it('reads a missing sheet as no overrides, without creating it', async () => {
    sheetTitles(TX);

    expect(await service.readCategoryOverrides(EXPENSE_CATEGORIES)).toEqual([]);
    expect(api.values.get).not.toHaveBeenCalled();
    expect(api.batchUpdate).not.toHaveBeenCalled();
  });

  it('skips hand-edited rows whose Category is outside the fixed list', async () => {
    sheetTitles(TX, 'CategoryOverrides');
    overrideRows('CategoryOverrides!A2:C3', [
      ['Las Brumas', 'Brunch', 'x'],
      ['Starbucks', 'Coffee & Quick Bites', 'y'],
    ]);

    expect(await service.readCategoryOverrides(EXPENSE_CATEGORIES)).toEqual([
      { merchant: 'Starbucks', category: 'Coffee & Quick Bites', updatedAt: 'y' },
    ]);
  });
});

describe('readCategories', () => {
  it('creates and seeds the Categories sheet with the built-in list when it is missing', async () => {
    sheetTitles(TX);

    const categories = await service.readCategories();

    expect(api.batchUpdate.mock.calls[0][0].requestBody.requests).toEqual([
      { addSheet: { properties: { title: 'Categories' } } },
    ]);
    expect(ranges(api.values.update)).toEqual(['Categories!A1:C26']);
    const [header, ...seed] = api.values.update.mock.calls[0][0].requestBody.values;
    expect(header).toEqual(['Category', 'Counts as Spending', 'Added-at']);
    expect(seed).toHaveLength(25);
    expect(
      seed.filter(([, spending]: unknown[]) => spending === false).map(([name]: unknown[]) => name)
    ).toEqual(['Investments & Savings', 'Transfers', 'Income']);
    expect(categories).toHaveLength(25);
    expect(categories).toContainEqual({ name: 'Transfers', countsAsSpending: false });
    expect(categories).toContainEqual({ name: 'Groceries', countsAsSpending: true });
  });

  it('reads the Category list, with hand-added rows and their Spending flag', async () => {
    sheetTitles(TX, 'Categories');
    overrideRows('Categories!A2:C5', [
      ['Groceries', true, '2026-10-14'],
      ['Transfers', false, '2026-10-14'],
      ['Pet Supplies', 'TRUE', ''],
      ['Car Loan', 'FALSE'],
    ]);

    expect(await service.readCategories()).toEqual([
      { name: 'Groceries', countsAsSpending: true },
      { name: 'Transfers', countsAsSpending: false },
      { name: 'Pet Supplies', countsAsSpending: true },
      { name: 'Car Loan', countsAsSpending: false },
    ]);
    expect(ranges(api.values.get)).toEqual(['Categories!A2:C']);
    expect(api.batchUpdate).not.toHaveBeenCalled();
  });

  it('skips blank and repeated names, trimming hand-typed ones', async () => {
    sheetTitles(TX, 'Categories');
    overrideRows('Categories!A2:C5', [
      ['  Groceries ', true],
      ['', false],
      ['Groceries', false],
      ['Income', false],
    ]);

    expect(await service.readCategories()).toEqual([
      { name: 'Groceries', countsAsSpending: true },
      { name: 'Income', countsAsSpending: false },
    ]);
  });

  it('fails the read when the sheet holds no Category, so callers fall back', async () => {
    sheetTitles(TX, 'Categories');
    overrideRows('Categories!A2:C', []);

    await expect(service.readCategories()).rejects.toThrow('no Categories');
  });
});
