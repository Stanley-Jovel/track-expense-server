import { Transaction } from '../spreadsheet/types';
import { merchantName } from './merchant';

// Sheet dates are parsed as UTC wall-clock time (see parse-row.ts), so every
// month/day bucket here uses UTC accessors to match.

/** "YYYY-MM" in UTC. */
export type MonthKey = string;

/** The time window a view covers: 'all', a year "YYYY", or a month "YYYY-MM". */
export type WindowKey = 'all' | string;

export interface DashboardFilter {
  window: WindowKey;
  type: 'all' | 'Income' | 'Expense';
  category: 'all' | string;
}

export function isYearKey(key: WindowKey): boolean {
  return /^\d{4}$/.test(key);
}

export function inWindow(t: Transaction, window: WindowKey): boolean {
  if (window === 'all') return true;
  if (isYearKey(window)) return String(t.date.getUTCFullYear()) === window;
  return monthKey(t.date) === window;
}

/** The comparison window: previous month for a month, previous year for a year. */
export function previousWindowKey(key: WindowKey): WindowKey {
  if (isYearKey(key)) return String(Number(key) - 1);
  return previousMonthKey(key);
}

// See GLOSSARY.md: Money Movement is excluded from Spending.
export const MONEY_MOVEMENT_CATEGORIES = ['Transfers', 'Investments & Savings'];

export function isMoneyMovement(t: Transaction): boolean {
  return t.type === 'Expense' && MONEY_MOVEMENT_CATEGORIES.includes(t.category);
}

export function isSpending(t: Transaction): boolean {
  return t.type === 'Expense' && !isMoneyMovement(t);
}

export function monthKey(date: Date): MonthKey {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function previousMonthKey(key: MonthKey): MonthKey {
  const [year, month] = key.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 2, 1));
  return monthKey(d);
}

const sum = (txs: Transaction[]) => txs.reduce((acc, t) => acc + t.amount, 0);

export function filterTransactions<T extends Transaction>(
  transactions: T[],
  filter: DashboardFilter
): T[] {
  return transactions.filter(
    (t) =>
      inWindow(t, filter.window) &&
      (filter.type === 'all' || t.type === filter.type) &&
      (filter.category === 'all' || t.category === filter.category)
  );
}

export interface PeriodProgress {
  /** Whether `now` falls inside the window ('all' is always current). */
  isCurrent: boolean;
  /** Calendar days elapsed within the window, at least 1. */
  elapsedDays: number;
  /** Window length in days; equals elapsedDays for complete windows and 'all'. */
  totalDays: number;
}

function daysInMonthOf(key: MonthKey): number {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function utcDayDiff(from: number, to: number): number {
  return Math.floor((to - from) / 86_400_000);
}

/** How far through the window `now` is. For 'all', the span of the data. */
export function periodProgress(
  transactions: Transaction[],
  window: WindowKey,
  now: Date
): PeriodProgress {
  if (window === 'all') {
    const times = transactions.map((t) => t.date.getTime());
    const days =
      times.length === 0
        ? 1
        : Math.max(1, utcDayDiff(Math.min(...times), now.getTime()) + 1);
    return { isCurrent: true, elapsedDays: days, totalDays: days };
  }
  if (isYearKey(window)) {
    const year = Number(window);
    const totalDays = daysInMonthOf(`${window}-02`) === 29 ? 366 : 365;
    const isCurrent = now.getUTCFullYear() === year;
    const elapsedDays = isCurrent
      ? utcDayDiff(Date.UTC(year, 0, 1), now.getTime()) + 1
      : totalDays;
    return { isCurrent, elapsedDays, totalDays };
  }
  const totalDays = daysInMonthOf(window);
  const isCurrent = monthKey(now) === window;
  return {
    isCurrent,
    elapsedDays: isCurrent ? now.getUTCDate() : totalDays,
    totalDays,
  };
}

export interface PaceStats {
  /** Spending in the window (type/category filters apply). */
  spending: number;
  moneyMovement: number;
  /** Spending transaction count in the window. */
  entries: number;
  /** Spending ÷ elapsed days — see GLOSSARY.md: Daily Average. */
  dailyAverage: number;
  /** Daily Average × window length — see GLOSSARY.md: Projected Spend. */
  projected: number;
  /** Previous window's Spending, full and cut to the same elapsed span.
      Null for 'all', which has no previous window. */
  previousTotal: number | null;
  previousAtSamePoint: number | null;
  progress: PeriodProgress;
}

/** Spending cut to the first `elapsedDays` days of the window. */
function spendingToPoint(
  transactions: Transaction[],
  filter: DashboardFilter,
  elapsedDays: number
): number {
  const rows = filterTransactions(transactions, filter).filter(isSpending);
  if (filter.window === 'all') return sum(rows);
  if (isYearKey(filter.window)) {
    const start = Date.UTC(Number(filter.window), 0, 1);
    return sum(rows.filter((t) => utcDayDiff(start, t.date.getTime()) < elapsedDays));
  }
  return sum(rows.filter((t) => t.date.getUTCDate() <= elapsedDays));
}

/** Hero/tile stats for the window, honest about incomplete periods. */
export function paceStats(
  transactions: Transaction[],
  filter: DashboardFilter,
  now: Date
): PaceStats {
  const progress = periodProgress(transactions, filter.window, now);
  const current = filterTransactions(transactions, filter);
  const spendingRows = current.filter(isSpending);
  const spending = sum(spendingRows);
  const dailyAverage = spending / progress.elapsedDays;

  let previousTotal: number | null = null;
  let previousAtSamePoint: number | null = null;
  if (filter.window !== 'all') {
    const prevFilter = { ...filter, window: previousWindowKey(filter.window) };
    previousTotal = sum(filterTransactions(transactions, prevFilter).filter(isSpending));
    previousAtSamePoint = progress.isCurrent
      ? spendingToPoint(transactions, prevFilter, progress.elapsedDays)
      : previousTotal;
  }

  return {
    spending,
    moneyMovement: sum(current.filter(isMoneyMovement)),
    entries: spendingRows.length,
    dailyAverage,
    projected: dailyAverage * progress.totalDays,
    previousTotal,
    previousAtSamePoint,
    progress,
  };
}

export interface PacePoint {
  /** Day of month for a month window; month number (1–12) for a year. */
  unit: number;
  /** Cumulative Spending; null past `now` in a current window. */
  current: number | null;
  previous: number;
}

/**
 * Cumulative Spending through the window against the previous window's
 * cumulative ghost. Month windows bucket by day, year windows by month;
 * not defined for 'all' (the all-time view uses spendingOverTime).
 */
export function cumulativePace(
  transactions: Transaction[],
  filter: DashboardFilter,
  now: Date
): PacePoint[] {
  if (filter.window === 'all') return [];
  const progress = periodProgress(transactions, filter.window, now);
  const rows = filterTransactions(transactions, filter).filter(isSpending);
  const prevRows = filterTransactions(transactions, {
    ...filter,
    window: previousWindowKey(filter.window),
  }).filter(isSpending);

  const yearly = isYearKey(filter.window);
  const units = yearly ? 12 : progress.totalDays;
  const bucket = (t: Transaction) =>
    yearly ? t.date.getUTCMonth() : t.date.getUTCDate() - 1;
  const perUnit = new Array<number>(units).fill(0);
  for (const t of rows) perUnit[bucket(t)] += t.amount;
  const prevPerUnit = new Array<number>(yearly ? 12 : 31).fill(0);
  for (const t of prevRows) prevPerUnit[bucket(t)] += t.amount;

  const lastUnit = !progress.isCurrent
    ? units
    : yearly
      ? now.getUTCMonth() + 1
      : now.getUTCDate();

  const points: PacePoint[] = [];
  let current = 0;
  let previous = 0;
  for (let u = 1; u <= units; u++) {
    if (u <= lastUnit) current += perUnit[u - 1];
    previous += prevPerUnit[u - 1] ?? 0;
    points.push({ unit: u, current: u <= lastUnit ? current : null, previous });
  }
  return points;
}

export interface CategoryMover {
  category: string;
  current: number;
  previous: number;
  /** current − previous; positive means more was spent than last window. */
  delta: number;
}

/**
 * Categories whose Spending moved most against the previous window, compared
 * over the same elapsed span so a half-finished window isn't judged against a
 * whole one. Empty for 'all'.
 */
export function biggestMovers(
  transactions: Transaction[],
  filter: DashboardFilter,
  now: Date,
  limit = 4
): CategoryMover[] {
  if (filter.window === 'all') return [];
  const progress = periodProgress(transactions, filter.window, now);
  const prevFilter = { ...filter, window: previousWindowKey(filter.window) };

  const totalsByCategory = (f: DashboardFilter, toPoint: boolean) => {
    const totals = new Map<string, number>();
    let rows = filterTransactions(transactions, f).filter(isSpending);
    if (toPoint && progress.isCurrent) {
      if (isYearKey(f.window)) {
        const start = Date.UTC(Number(f.window), 0, 1);
        rows = rows.filter(
          (t) => utcDayDiff(start, t.date.getTime()) < progress.elapsedDays
        );
      } else {
        rows = rows.filter((t) => t.date.getUTCDate() <= progress.elapsedDays);
      }
    }
    for (const t of rows) totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
    return totals;
  };

  const current = totalsByCategory(filter, false);
  const previous = totalsByCategory(prevFilter, true);
  return [...new Set([...current.keys(), ...previous.keys()])]
    .map((category) => {
      const a = current.get(category) ?? 0;
      const b = previous.get(category) ?? 0;
      return { category, current: a, previous: b, delta: a - b };
    })
    .sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta))
    .slice(0, limit);
}

export interface MerchantTotal {
  merchant: string;
  amount: number;
  count: number;
}

/** Top Spending by canonical Merchant (clustered motives), largest first. */
export function topMerchants(
  transactions: Transaction[],
  filter: DashboardFilter,
  limit = 8
): MerchantTotal[] {
  const rows = filterTransactions(transactions, filter).filter(isSpending);
  const byMerchant = new Map<string, MerchantTotal>();
  for (const t of rows) {
    const merchant = merchantName(t.motive);
    const entry = byMerchant.get(merchant) ?? { merchant, amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    byMerchant.set(merchant, entry);
  }
  return [...byMerchant.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export interface TimePoint {
  /** UTC day of month ("1".."31") for a month window, "YYYY-MM" otherwise. */
  label: string;
  amount: number;
}

/**
 * Spending trend: per-day within a month; per-month for a year (all 12,
 * zero-filled) or all-time (data's month span, gap-filled).
 */
export function spendingOverTime(
  transactions: Transaction[],
  filter: DashboardFilter
): TimePoint[] {
  const spending = filterTransactions(transactions, filter).filter(isSpending);

  if (filter.window === 'all' || isYearKey(filter.window)) {
    const keys = isYearKey(filter.window)
      ? Array.from({ length: 12 }, (_, i) => `${filter.window}-${String(i + 1).padStart(2, '0')}`)
      : allMonthKeys(transactions);
    return keys.map((key) => ({
      label: key,
      amount: sum(spending.filter((t) => monthKey(t.date) === key)),
    }));
  }

  const [year, month] = filter.window.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const byDay = new Array<number>(daysInMonth).fill(0);
  for (const t of spending) {
    byDay[t.date.getUTCDate() - 1] += t.amount;
  }
  return byDay.map((amount, i) => ({ label: String(i + 1), amount }));
}

export interface CategorySlice {
  category: string;
  amount: number;
  count: number;
}

/** Expenses-only (Spending) breakdown, largest first. Money Movement is not a slice. */
export function categoryBreakdown(
  transactions: Transaction[],
  filter: DashboardFilter
): CategorySlice[] {
  const spending = filterTransactions(transactions, filter).filter(isSpending);
  const byCategory = new Map<string, CategorySlice>();
  for (const t of spending) {
    const slice = byCategory.get(t.category) ?? {
      category: t.category,
      amount: 0,
      count: 0,
    };
    slice.amount += t.amount;
    slice.count += 1;
    byCategory.set(t.category, slice);
  }
  return [...byCategory.values()].sort((a, b) => b.amount - a.amount);
}

/** Distinct categories present in the data, alphabetical. */
export function allCategories(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => t.category))].sort();
}

/** Distinct years present in the data, ascending. */
export function allYearKeys(transactions: Transaction[]): string[] {
  return [...new Set(allMonthKeys(transactions).map((k) => k.slice(0, 4)))];
}

/** Every month between the earliest and latest transaction, ascending, no gaps. */
export function allMonthKeys(transactions: Transaction[]): MonthKey[] {
  if (transactions.length === 0) return [];
  const times = transactions.map((t) => t.date.getTime());
  const first = new Date(Math.min(...times));
  const last = new Date(Math.max(...times));
  const keys: MonthKey[] = [];
  const cursor = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1));
  while (cursor.getTime() <= last.getTime()) {
    keys.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return keys;
}
