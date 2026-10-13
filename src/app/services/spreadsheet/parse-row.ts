import { SheetTransaction, Transaction } from './types';

// Google Sheets date serials count days since 1899-12-30. The serial carries
// no timezone (it's the sheet's wall-clock time), so convert in UTC and keep
// all downstream date math in UTC to avoid DST shifts.
const SHEETS_EPOCH_UTC_MS = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

export function serialToDate(serial: number): Date {
  return new Date(SHEETS_EPOCH_UTC_MS + Math.round(serial * MS_PER_DAY));
}

/**
 * Parse one raw sheet row (A:E = date serial, motive, amount, type, category)
 * as returned with valueRenderOption UNFORMATTED_VALUE. Returns null for rows
 * that don't conform; callers skip and count those rather than throw.
 */
export function parseTransactionRow(row: unknown[]): Transaction | null {
  const [serial, motive, amount, type, category] = row;

  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  if (typeof motive !== 'string' || motive.length === 0) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (type !== 'Income' && type !== 'Expense') return null;
  if (typeof category !== 'string' || category.length === 0) return null;

  return {
    date: serialToDate(serial),
    motive,
    amount,
    type,
    category,
  };
}

/**
 * Parse the rows of a read that starts at `firstRow` (A2 → 2). Each parsed
 * Transaction keeps its sheet row number; skipped rows still occupy theirs.
 */
export function parseTransactionRows(
  rows: unknown[][],
  firstRow = 2
): {
  transactions: SheetTransaction[];
  skippedRowCount: number;
} {
  const transactions: SheetTransaction[] = [];
  let skippedRowCount = 0;

  for (const [i, row] of rows.entries()) {
    const parsed = parseTransactionRow(row);
    if (parsed) {
      transactions.push({ ...parsed, row: firstRow + i });
    } else {
      skippedRowCount++;
    }
  }

  return { transactions, skippedRowCount };
}
