import { ParsedTransaction, ExpenseType, ExpenseCategory } from '../llm/types';

// A transaction read back from the sheet. `category` is a plain string rather
// than ExpenseCategory: the sheet is the source of truth and may hold values
// written before the current category list existed.
export interface Transaction {
  date: Date;
  motive: string;
  amount: number;
  type: ExpenseType;
  category: string;
}

// A Transaction as read from the sheet, carrying its 1-based sheet row number
// (the header is row 1). Rows are only ever appended, never deleted or
// reordered, so the number is a stable identity for rewriting that row.
export interface SheetTransaction extends Transaction {
  row: number;
}

/** Replace the Category cell of one existing sheet row. */
export interface CategoryRewrite {
  row: number;
  category: ExpenseCategory;
}

/**
 * A user-chosen Merchant → Category mapping (see GLOSSARY.md: Category
 * Override), one row per Merchant in the CategoryOverrides sheet.
 */
export interface CategoryOverride {
  merchant: string;
  category: ExpenseCategory;
  /** ISO timestamp of the last save. */
  updatedAt: string;
}

export interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[]): Promise<void>;
  readTransactions(): Promise<SheetTransaction[]>;
  /**
   * Rewrite the Category column of the given rows, in one batch. Category
   * and amount are the only cells the app ever edits on an existing row:
   * Date, Motive and Type stay append-only.
   */
  rewriteCategories(rewrites: CategoryRewrite[]): Promise<void>;
  /** Replace the amount cell of one existing sheet row. */
  rewriteAmount(row: number, amount: number): Promise<void>;
  readCategoryOverrides(): Promise<CategoryOverride[]>;
  /**
   * Save an override, replacing any existing one for the same Merchant
   * (compared case-insensitively, see sameMerchant).
   */
  upsertCategoryOverride(override: CategoryOverride): Promise<void>;
}

export class SpreadsheetReadError extends Error {
  constructor(message: string = 'Failed to read from spreadsheet') {
    super(message);
    this.name = 'SpreadsheetReadError';
  }
}

export class SpreadsheetWriteError extends Error {
  constructor(message: string = 'Failed to write to spreadsheet') {
    super(message);
    this.name = 'SpreadsheetWriteError';
  }
}

export class SpreadsheetPermissionError extends SpreadsheetWriteError {
  constructor() {
    super('Permission denied');
    this.name = 'SpreadsheetPermissionError';
  }
} 