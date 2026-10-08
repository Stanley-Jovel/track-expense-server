import {
  parseTransactionRow,
  parseTransactionRows,
  serialToDate,
} from '@/app/services/spreadsheet/parse-row';

describe('serialToDate', () => {
  it('converts a whole-day serial to UTC midnight', () => {
    // 45659 = 2025-01-02 (observed live: "1/2/2025 0:00:00")
    expect(serialToDate(45659).toISOString()).toBe('2025-01-02T00:00:00.000Z');
  });

  it('converts a fractional serial to wall-clock time in UTC', () => {
    // 46189.71658564815 = 2026-06-16 17:11:53 (observed live)
    expect(serialToDate(46189.71658564815).toISOString()).toBe(
      '2026-06-16T17:11:53.000Z'
    );
  });
});

describe('parseTransactionRow', () => {
  const validRow = [45659, 'Safeway #1885 Seattle WA', 38.13, 'Expense', 'Groceries'];

  it('parses a conforming row', () => {
    expect(parseTransactionRow(validRow)).toEqual({
      date: new Date('2025-01-02T00:00:00.000Z'),
      motive: 'Safeway #1885 Seattle WA',
      amount: 38.13,
      type: 'Expense',
      category: 'Groceries',
    });
  });

  it('accepts categories outside the current LLM category list', () => {
    const row = [45659, 'Old automation', 10, 'Expense', 'Some Legacy Category'];
    expect(parseTransactionRow(row)?.category).toBe('Some Legacy Category');
  });

  it.each([
    ['string date', ['1/2/2025', 'm', 1, 'Expense', 'Groceries']],
    ['missing columns', [45659, 'm', 1, 'Expense']],
    ['non-numeric amount', [45659, 'm', '$38.13', 'Expense', 'Groceries']],
    ['bad type', [45659, 'm', 1, 'Refund', 'Groceries']],
    ['empty motive', [45659, '', 1, 'Expense', 'Groceries']],
    ['empty category', [45659, 'm', 1, 'Expense', '']],
    ['empty row', []],
  ])('rejects %s', (_label, row) => {
    expect(parseTransactionRow(row as unknown[])).toBeNull();
  });
});

describe('parseTransactionRows', () => {
  it('keeps good rows and counts skipped ones', () => {
    const rows = [
      [45659, 'Safeway', 38.13, 'Expense', 'Groceries'],
      ['garbage'],
      [45660, 'Paycheck', 2500, 'Income', 'Income'],
    ];
    const { transactions, skippedRowCount } = parseTransactionRows(rows);
    expect(transactions).toHaveLength(2);
    expect(skippedRowCount).toBe(1);
    expect(transactions[1].type).toBe('Income');
  });
});
