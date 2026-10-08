import {
  allCategories,
  allMonthKeys,
  categoryBreakdown,
  computeStats,
  filterTransactions,
  incomeVsSpendingByMonth,
  monthKey,
  previousMonthKey,
  spendingOverTime,
  topMotives,
  DashboardFilter,
} from '@/app/services/analytics/aggregate';
import { Transaction } from '@/app/services/spreadsheet/types';

const tx = (
  iso: string,
  amount: number,
  overrides: Partial<Transaction> = {}
): Transaction => ({
  date: new Date(iso),
  motive: 'motive',
  amount,
  type: 'Expense',
  category: 'Groceries',
  ...overrides,
});

const ALL: DashboardFilter = { month: 'all', type: 'all', category: 'all' };
const JAN: DashboardFilter = { ...ALL, month: '2026-01' };

describe('month keys', () => {
  it('uses UTC for month bucketing at month boundaries', () => {
    // 23:30 UTC on Jan 31 stays in January even in timezones where it's Feb 1.
    expect(monthKey(new Date('2026-01-31T23:30:00.000Z'))).toBe('2026-01');
  });

  it('previousMonthKey crosses year boundaries', () => {
    expect(previousMonthKey('2026-01')).toBe('2025-12');
  });

  it('allMonthKeys fills gaps between first and last month', () => {
    const keys = allMonthKeys([tx('2025-11-15T00:00:00Z', 1), tx('2026-02-02T00:00:00Z', 1)]);
    expect(keys).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });
});

describe('computeStats — Spending per the glossary', () => {
  const data = [
    tx('2026-01-05T00:00:00Z', 100), // spending
    tx('2026-01-06T00:00:00Z', 2000, { category: 'Transfers' }), // money movement
    tx('2026-01-07T00:00:00Z', 500, { category: 'Investments & Savings' }), // money movement
    tx('2026-01-08T00:00:00Z', 5, { category: 'Bank & FX Fees' }), // spending (fees are real)
    tx('2026-01-10T00:00:00Z', 3000, { type: 'Income', category: 'Income' }),
    tx('2025-12-20T00:00:00Z', 40), // previous month spending
  ];

  it('excludes Transfers and Investments & Savings from spending', () => {
    const stats = computeStats(data, JAN);
    expect(stats.spending).toBe(105);
    expect(stats.moneyMovement).toBe(2500);
    expect(stats.income).toBe(3000);
    expect(stats.net).toBe(2895);
  });

  it('reports previous-month figures for a month filter', () => {
    expect(computeStats(data, JAN).previous).toEqual({ spending: 40, income: 0 });
  });

  it('has no previous figures for all-time', () => {
    const stats = computeStats(data, ALL);
    expect(stats.previous).toBeNull();
    expect(stats.spending).toBe(145);
  });
});

describe('filterTransactions', () => {
  const data = [
    tx('2026-01-05T00:00:00Z', 1),
    tx('2026-02-05T00:00:00Z', 2, { category: 'Travel' }),
    tx('2026-02-06T00:00:00Z', 3, { type: 'Income', category: 'Income' }),
  ];

  it('filters by month, type, and category together', () => {
    expect(filterTransactions(data, { month: '2026-02', type: 'Expense', category: 'all' })).toHaveLength(1);
    expect(filterTransactions(data, { ...ALL, category: 'Travel' })).toHaveLength(1);
    expect(filterTransactions(data, { ...ALL, type: 'Income' })).toHaveLength(1);
    expect(filterTransactions(data, ALL)).toHaveLength(3);
  });
});

describe('spendingOverTime', () => {
  it('zero-fills every day of a month window', () => {
    const series = spendingOverTime(
      [tx('2026-01-05T10:00:00Z', 10), tx('2026-01-05T12:00:00Z', 5), tx('2026-01-31T00:00:00Z', 7)],
      JAN
    );
    expect(series).toHaveLength(31);
    expect(series[4]).toEqual({ label: '5', amount: 15 });
    expect(series[30]).toEqual({ label: '31', amount: 7 });
    expect(series[0].amount).toBe(0);
  });

  it('handles leap February', () => {
    expect(spendingOverTime([tx('2028-02-29T00:00:00Z', 1)], { ...ALL, month: '2028-02' })).toHaveLength(29);
  });

  it('buckets by month for all-time and excludes money movement', () => {
    const series = spendingOverTime(
      [tx('2025-12-01T00:00:00Z', 10), tx('2026-01-01T00:00:00Z', 99, { category: 'Transfers' })],
      ALL
    );
    expect(series).toEqual([
      { label: '2025-12', amount: 10 },
      { label: '2026-01', amount: 0 },
    ]);
  });
});

describe('categoryBreakdown', () => {
  it('is spending-only, aggregated and sorted desc', () => {
    const slices = categoryBreakdown(
      [
        tx('2026-01-01T00:00:00Z', 10),
        tx('2026-01-02T00:00:00Z', 20),
        tx('2026-01-03T00:00:00Z', 50, { category: 'Travel' }),
        tx('2026-01-04T00:00:00Z', 999, { category: 'Transfers' }),
        tx('2026-01-05T00:00:00Z', 999, { type: 'Income', category: 'Income' }),
      ],
      JAN
    );
    expect(slices).toEqual([
      { category: 'Travel', amount: 50, count: 1 },
      { category: 'Groceries', amount: 30, count: 2 },
    ]);
  });
});

describe('incomeVsSpendingByMonth', () => {
  it('always spans all months regardless of the month filter', () => {
    const series = incomeVsSpendingByMonth(
      [
        tx('2025-12-01T00:00:00Z', 10),
        tx('2026-01-15T00:00:00Z', 3000, { type: 'Income', category: 'Income' }),
      ],
      JAN
    );
    expect(series).toEqual([
      { month: '2025-12', income: 0, spending: 10 },
      { month: '2026-01', income: 3000, spending: 0 },
    ]);
  });
});

describe('topMotives', () => {
  it('ranks spending motives by total with counts, respecting the limit', () => {
    const data = [
      tx('2026-01-01T00:00:00Z', 10, { motive: 'Safeway' }),
      tx('2026-01-02T00:00:00Z', 15, { motive: 'Safeway' }),
      tx('2026-01-03T00:00:00Z', 20, { motive: 'Shell' }),
      tx('2026-01-04T00:00:00Z', 9999, { motive: 'Vanguard', category: 'Investments & Savings' }),
      tx('2026-01-05T00:00:00Z', 1, { motive: 'Corner store' }),
    ];
    expect(topMotives(data, JAN, 2)).toEqual([
      { motive: 'Safeway', amount: 25, count: 2 },
      { motive: 'Shell', amount: 20, count: 1 },
    ]);
  });
});

describe('allCategories', () => {
  it('returns distinct categories from the data, sorted', () => {
    expect(
      allCategories([tx('2026-01-01T00:00:00Z', 1, { category: 'Travel' }), tx('2026-01-02T00:00:00Z', 1)])
    ).toEqual(['Groceries', 'Travel']);
  });
});
