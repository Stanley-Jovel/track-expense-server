import { Transaction } from '../spreadsheet/types';

// Sheet dates are parsed as UTC wall-clock time (see parse-row.ts), so every
// month/day bucket here uses UTC accessors to match.

/** "YYYY-MM" in UTC, or 'all' for the whole history. */
export type MonthKey = string;

export interface DashboardFilter {
  month: MonthKey | 'all';
  type: 'all' | 'Income' | 'Expense';
  category: 'all' | string;
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

export function filterTransactions(
  transactions: Transaction[],
  filter: DashboardFilter
): Transaction[] {
  return transactions.filter(
    (t) =>
      (filter.month === 'all' || monthKey(t.date) === filter.month) &&
      (filter.type === 'all' || t.type === filter.type) &&
      (filter.category === 'all' || t.category === filter.category)
  );
}

export interface Stats {
  spending: number;
  income: number;
  /** income − spending; Money Movement affects neither side. */
  net: number;
  moneyMovement: number;
  /** Previous-month comparisons; null when the filter is all-time. */
  previous: { spending: number; income: number } | null;
}

/** Tile stats for the filtered window. Type/category filters apply. */
export function computeStats(
  transactions: Transaction[],
  filter: DashboardFilter
): Stats {
  const current = filterTransactions(transactions, filter);
  const stats = {
    spending: sum(current.filter(isSpending)),
    income: sum(current.filter((t) => t.type === 'Income')),
    moneyMovement: sum(current.filter(isMoneyMovement)),
  };

  let previous: Stats['previous'] = null;
  if (filter.month !== 'all') {
    const prev = filterTransactions(transactions, {
      ...filter,
      month: previousMonthKey(filter.month),
    });
    previous = {
      spending: sum(prev.filter(isSpending)),
      income: sum(prev.filter((t) => t.type === 'Income')),
    };
  }

  return { ...stats, net: stats.income - stats.spending, previous };
}

export interface TimePoint {
  /** UTC day of month ("1".."31") for a month window, "YYYY-MM" for all-time. */
  label: string;
  amount: number;
}

/** Spending trend: per-day within a month, per-month for all-time. Gaps are zero-filled. */
export function spendingOverTime(
  transactions: Transaction[],
  filter: DashboardFilter
): TimePoint[] {
  const spending = filterTransactions(transactions, filter).filter(isSpending);

  if (filter.month === 'all') {
    return allMonthKeys(transactions).map((key) => ({
      label: key,
      amount: sum(spending.filter((t) => monthKey(t.date) === key)),
    }));
  }

  const [year, month] = filter.month.split('-').map(Number);
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

export interface MonthlyComparison {
  month: MonthKey;
  income: number;
  spending: number;
}

/**
 * Income vs Spending per month across the whole history (always all-time:
 * this chart is the zoomed-out view, so the month filter does not apply;
 * the category filter applies to the spending side only).
 */
export function incomeVsSpendingByMonth(
  transactions: Transaction[],
  filter: DashboardFilter
): MonthlyComparison[] {
  return allMonthKeys(transactions).map((key) => {
    const inMonth = transactions.filter((t) => monthKey(t.date) === key);
    return {
      month: key,
      income: sum(inMonth.filter((t) => t.type === 'Income')),
      spending: sum(
        inMonth
          .filter(isSpending)
          .filter((t) => filter.category === 'all' || t.category === filter.category)
      ),
    };
  });
}

export interface MotiveTotal {
  motive: string;
  amount: number;
  count: number;
}

/** Top Spending motives by total amount, with transaction counts. */
export function topMotives(
  transactions: Transaction[],
  filter: DashboardFilter,
  limit = 10
): MotiveTotal[] {
  const spending = filterTransactions(transactions, filter).filter(isSpending);
  const byMotive = new Map<string, MotiveTotal>();
  for (const t of spending) {
    const entry = byMotive.get(t.motive) ?? { motive: t.motive, amount: 0, count: 0 };
    entry.amount += t.amount;
    entry.count += 1;
    byMotive.set(t.motive, entry);
  }
  return [...byMotive.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

/** Distinct categories present in the data, alphabetical. */
export function allCategories(transactions: Transaction[]): string[] {
  return [...new Set(transactions.map((t) => t.category))].sort();
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
