import { ParsedTransaction, ExpenseType, ExpenseCategory, CategoryEntry } from '../llm/types';
import type { CategorySpelling } from '../categories/open-categories';

// A transaction read back from the sheet. `category` is a plain string rather
// than ExpenseCategory: the sheet is the source of truth and may hold values
// written before the current category list existed.
export interface Transaction {
  date: Date;
  motive: string;
  amount: number;
  type: ExpenseType;
  category: string;
  /** Column F: the Category the LLM suggested, waiting for review. */
  suggestedCategory?: string;
}

// A Transaction as read from the sheet, carrying its 1-based sheet row number
// (the header is row 1). Deleting a row shifts every later row up by one, so
// every write that targets a row number re-checks that row's contents first.
export interface SheetTransaction extends Transaction {
  row: number;
}

/**
 * The cells of one existing sheet row that Modify can rewrite: everything
 * except Type.
 */
export interface TransactionRewrite {
  date: Date;
  motive: string;
  amount: number;
  category: string;
}

/** Replace the Category cell of one existing sheet row. */
export interface CategoryRewrite {
  row: number;
  category: ExpenseCategory;
}

/**
 * Rewrite the Suggested Category cell (F) of one existing sheet row, and its
 * Category cell (E) too when `category` is given. An empty
 * `suggestedCategory` clears F.
 */
export interface SuggestionRewrite {
  row: number;
  category?: ExpenseCategory;
  suggestedCategory: string;
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
   * The Category list from the Categories sheet (Category, Counts as
   * Spending, Added-at). A missing sheet is created and seeded with the
   * built-in Categories. Throws SpreadsheetReadError when the list can't be
   * read or holds no Category, so callers fall back to the built-in list.
   */
  readCategories(): Promise<CategoryEntry[]>;
  /** Append one Category to the Categories sheet (creating it if missing). */
  addCategory(entry: CategoryEntry): Promise<void>;
  /**
   * Rewrite the Category column of the given rows, in one batch.
   */
  rewriteCategories(rewrites: CategoryRewrite[]): Promise<void>;
  /** Rewrite F (and E where given) of the given rows, in one batch. */
  rewriteSuggestions(rewrites: SuggestionRewrite[]): Promise<void>;
  /**
   * Replace the Date, Motive, amount and Category cells of one existing
   * sheet row (Modify). Type is never rewritten.
   */
  rewriteTransaction(row: number, rewrite: TransactionRewrite): Promise<void>;
  /** Remove one sheet row entirely; later rows shift up by one. */
  deleteTransactionRow(row: number): Promise<void>;
  /** Overrides whose Category is on `categories`; others are skipped. */
  readCategoryOverrides(categories: readonly string[]): Promise<CategoryOverride[]>;
  /**
   * Save an override, replacing any existing one for the same Merchant
   * (compared case-insensitively, see sameMerchant).
   */
  upsertCategoryOverride(override: CategoryOverride): Promise<void>;
  /**
   * The CategorySpellings sheet (Spelling, Outcome, Target, Updated-at). A
   * missing sheet reads as no spellings. Throws SpreadsheetReadError.
   */
  readCategorySpellings(): Promise<CategorySpelling[]>;
  /**
   * Record spellings, creating the sheet if it's missing. A spelling already
   * in the sheet has its row replaced, so the latest answer wins.
   */
  recordCategorySpellings(spellings: CategorySpelling[]): Promise<void>;
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