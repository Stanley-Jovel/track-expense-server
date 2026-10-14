import {
  allCategories,
  allMonthKeys,
  biggestMovers,
  categoryBreakdown,
  cumulativePace,
  filterTransactions,
  monthKey,
  paceStats,
  periodProgress,
  previousMonthKey,
  spendingOverTime,
  topMerchants,
  DashboardFilter,
} from '@/app/services/analytics/aggregate';
import { merchantName } from '@/app/services/analytics/merchant';
import { Transaction } from '@/app/services/spreadsheet/types';
import { BUILT_IN_NOT_SPENDING } from '@/app/services/llm/types';

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

const ALL: DashboardFilter = { window: 'all', type: 'all', category: 'all' };
const JAN: DashboardFilter = { ...ALL, window: '2026-01' };

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

describe('periodProgress', () => {
  const data = [tx('2026-01-01T00:00:00Z', 1)];

  it('marks the month containing `now` current and counts elapsed days', () => {
    const p = periodProgress(data, '2026-01', new Date('2026-01-20T12:00:00Z'));
    expect(p).toEqual({ isCurrent: true, elapsedDays: 20, totalDays: 31 });
  });

  it('treats past months as fully elapsed', () => {
    const p = periodProgress(data, '2025-11', new Date('2026-01-20T12:00:00Z'));
    expect(p).toEqual({ isCurrent: false, elapsedDays: 30, totalDays: 30 });
  });

  it('handles year windows, including leap years', () => {
    expect(periodProgress(data, '2028', new Date('2026-02-10T00:00:00Z'))).toEqual({
      isCurrent: false,
      elapsedDays: 366,
      totalDays: 366,
    });
    expect(
      periodProgress(data, '2026', new Date('2026-02-10T00:00:00Z')).elapsedDays
    ).toBe(41); // Jan 31 + Feb 10
  });

  it("spans first transaction to now for 'all'", () => {
    const p = periodProgress(data, 'all', new Date('2026-01-11T00:00:00Z'));
    expect(p).toEqual({ isCurrent: true, elapsedDays: 11, totalDays: 11 });
  });
});

describe('paceStats — Spending per the glossary', () => {
  const NOW = new Date('2026-01-20T12:00:00Z');
  const data = [
    tx('2026-01-05T00:00:00Z', 100), // spending
    tx('2026-01-06T00:00:00Z', 2000, { category: 'Transfers' }), // money movement
    tx('2026-01-07T00:00:00Z', 500, { category: 'Investments & Savings' }), // money movement
    tx('2026-01-08T00:00:00Z', 5, { category: 'Bank & FX Fees' }), // spending (fees are real)
    tx('2026-01-10T00:00:00Z', 3000, { type: 'Income', category: 'Income' }),
    tx('2025-12-10T00:00:00Z', 40), // previous month, before day 20
    tx('2025-12-28T00:00:00Z', 60), // previous month, after day 20
  ];

  it('excludes Transfers and Investments & Savings from spending', () => {
    const stats = paceStats(data, JAN, BUILT_IN_NOT_SPENDING, NOW);
    expect(stats.spending).toBe(105);
    expect(stats.moneyMovement).toBe(2500);
    expect(stats.entries).toBe(2);
  });

  it('computes Daily Average and Projected Spend from elapsed days', () => {
    const stats = paceStats(data, JAN, BUILT_IN_NOT_SPENDING, NOW);
    expect(stats.dailyAverage).toBeCloseTo(105 / 20);
    expect(stats.projected).toBeCloseTo((105 / 20) * 31);
  });

  it('cuts the previous window to the same elapsed span when current', () => {
    const stats = paceStats(data, JAN, BUILT_IN_NOT_SPENDING, NOW);
    expect(stats.previousAtSamePoint).toBe(40); // Dec 28 falls after day 20
    expect(stats.previousTotal).toBe(100);
  });

  it('uses the full previous window for complete windows', () => {
    const stats = paceStats(data, JAN, BUILT_IN_NOT_SPENDING, new Date('2026-03-01T00:00:00Z'));
    expect(stats.previousAtSamePoint).toBe(100);
    expect(stats.projected).toBeCloseTo(stats.spending);
  });

  it("has no previous figures for 'all'", () => {
    const stats = paceStats(data, ALL, BUILT_IN_NOT_SPENDING, NOW);
    expect(stats.previousTotal).toBeNull();
    expect(stats.previousAtSamePoint).toBeNull();
    expect(stats.spending).toBe(205);
  });
});

describe('cumulativePace', () => {
  const NOW = new Date('2026-01-20T12:00:00Z');
  const data = [
    tx('2026-01-05T00:00:00Z', 10),
    tx('2026-01-15T00:00:00Z', 20),
    tx('2025-12-10T00:00:00Z', 40),
  ];

  it('accumulates by day and nulls out days past now in a current month', () => {
    const points = cumulativePace(data, JAN, BUILT_IN_NOT_SPENDING, NOW);
    expect(points).toHaveLength(31);
    expect(points[3]).toEqual({ unit: 4, current: 0, previous: 0 });
    expect(points[4]).toEqual({ unit: 5, current: 10, previous: 0 });
    expect(points[19]).toEqual({ unit: 20, current: 30, previous: 40 });
    expect(points[20].current).toBeNull();
    expect(points[30].previous).toBe(40);
  });

  it('accumulates by month for a year window', () => {
    const points = cumulativePace(
      data,
      { ...ALL, window: '2026' },
      BUILT_IN_NOT_SPENDING,
      new Date('2026-03-05T00:00:00Z')
    );
    expect(points).toHaveLength(12);
    expect(points[0]).toEqual({ unit: 1, current: 30, previous: 0 });
    expect(points[11]).toEqual({ unit: 12, current: null, previous: 40 });
  });

  it("is empty for 'all'", () => {
    expect(cumulativePace(data, ALL, BUILT_IN_NOT_SPENDING, NOW)).toEqual([]);
  });
});

describe('biggestMovers', () => {
  const NOW = new Date('2026-01-20T12:00:00Z');
  const data = [
    tx('2026-01-05T00:00:00Z', 100), // Groceries, this month
    tx('2025-12-05T00:00:00Z', 30), // Groceries, last month before day 20
    tx('2025-12-28T00:00:00Z', 500, { category: 'Travel' }), // after day 20: excluded
    tx('2025-12-10T00:00:00Z', 25, { category: 'Travel' }),
  ];

  it('compares the same elapsed span of the previous window, sorted by |delta|', () => {
    expect(biggestMovers(data, JAN, BUILT_IN_NOT_SPENDING, NOW)).toEqual([
      { category: 'Groceries', current: 100, previous: 30, delta: 70 },
      { category: 'Travel', current: 0, previous: 25, delta: -25 },
    ]);
  });

  it("is empty for 'all'", () => {
    expect(biggestMovers(data, ALL, BUILT_IN_NOT_SPENDING, NOW)).toEqual([]);
  });
});

describe('merchantName', () => {
  it('maps known clusters to one canonical name', () => {
    expect(merchantName("Trader Joe S #13 4555 Roo")).toBe("Trader Joe's");
    expect(merchantName('Cvs/pharmacy #10 10331--5')).toBe('CVS Pharmacy');
    expect(merchantName('Amazon Mktpl*Z53IK Amzn.Com/Bill WA')).toBe('Amazon');
  });

  it('strips processor prefixes, store numbers, and city/state tails', () => {
    expect(merchantName('SQ * Corner Cafe Seattle WA')).toBe('Corner Cafe');
    expect(merchantName('Fedex Office #736')).toBe('FedEx Office');
  });

  it('keeps the merchant, not the processor, from Processor*Merchant motives', () => {
    expect(merchantName('N1co*las Brumas N1co')).toBe('Las Brumas');
    expect(merchantName('N1co*gimnasio Vikingo')).toBe('Gimnasio Vikingo');
    expect(merchantName('Wompi*super Mas')).toBe('Super Mas');
    expect(merchantName('Openpay*keki Manga')).toBe('Keki Manga');
  });

  it('leaves a star after an unknown word alone rather than guessing', () => {
    expect(merchantName('Gera valia*parama')).toBe('Gera valia*parama');
  });

  it('capitalizes manual free-text entries and keeps clean names intact', () => {
    expect(merchantName('groceries')).toBe('Groceries');
    expect(merchantName('Nectar Lounge')).toBe('Nectar Lounge');
  });
});

describe('topMerchants', () => {
  it('clusters motive variants under one merchant, spending only', () => {
    const data = [
      tx('2026-01-01T00:00:00Z', 10, { motive: 'Safeway' }),
      tx('2026-01-02T00:00:00Z', 15, { motive: 'Safeway #1885 Seattle WA' }),
      tx('2026-01-03T00:00:00Z', 20, { motive: 'Shell' }),
      tx('2026-01-04T00:00:00Z', 9999, { motive: 'Vanguard', category: 'Investments & Savings' }),
    ];
    expect(topMerchants(data, JAN, BUILT_IN_NOT_SPENDING, 2)).toEqual([
      { merchant: 'Safeway', amount: 25, count: 2 },
      { merchant: 'Shell', amount: 20, count: 1 },
    ]);
  });
});

describe('filterTransactions', () => {
  const data = [
    tx('2026-01-05T00:00:00Z', 1),
    tx('2026-02-05T00:00:00Z', 2, { category: 'Travel' }),
    tx('2026-02-06T00:00:00Z', 3, { type: 'Income', category: 'Income' }),
  ];

  it('filters by month, type, and category together', () => {
    expect(filterTransactions(data, { window: '2026-02', type: 'Expense', category: 'all' })).toHaveLength(1);
    expect(filterTransactions(data, { ...ALL, category: 'Travel' })).toHaveLength(1);
    expect(filterTransactions(data, { ...ALL, type: 'Income' })).toHaveLength(1);
    expect(filterTransactions(data, ALL)).toHaveLength(3);
  });
});

describe('spendingOverTime', () => {
  it('zero-fills every day of a month window', () => {
    const series = spendingOverTime(
      [tx('2026-01-05T10:00:00Z', 10), tx('2026-01-05T12:00:00Z', 5), tx('2026-01-31T00:00:00Z', 7)],
      JAN,
      BUILT_IN_NOT_SPENDING
    );
    expect(series).toHaveLength(31);
    expect(series[4]).toEqual({ label: '5', amount: 15 });
    expect(series[30]).toEqual({ label: '31', amount: 7 });
    expect(series[0].amount).toBe(0);
  });

  it('handles leap February', () => {
    expect(spendingOverTime([tx('2028-02-29T00:00:00Z', 1)], { ...ALL, window: '2028-02' }, BUILT_IN_NOT_SPENDING)).toHaveLength(29);
  });

  it('buckets by month for all-time and excludes money movement', () => {
    const series = spendingOverTime(
      [tx('2025-12-01T00:00:00Z', 10), tx('2026-01-01T00:00:00Z', 99, { category: 'Transfers' })],
      ALL,
      BUILT_IN_NOT_SPENDING
    );
    expect(series).toEqual([
      { label: '2025-12', amount: 10 },
      { label: '2026-01', amount: 0 },
    ]);
  });

  it('buckets the trend into all 12 months of a year window, zero-filled', () => {
    const series = spendingOverTime(
      [tx('2026-01-05T00:00:00Z', 100), tx('2026-06-05T00:00:00Z', 60)],
      { ...ALL, window: '2026' },
      BUILT_IN_NOT_SPENDING
    );
    expect(series).toHaveLength(12);
    expect(series[0]).toEqual({ label: '2026-01', amount: 100 });
    expect(series[5]).toEqual({ label: '2026-06', amount: 60 });
    expect(series[11]).toEqual({ label: '2026-12', amount: 0 });
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
      JAN,
      BUILT_IN_NOT_SPENDING
    );
    expect(slices).toEqual([
      { category: 'Travel', amount: 50, count: 1 },
      { category: 'Groceries', amount: 30, count: 2 },
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
