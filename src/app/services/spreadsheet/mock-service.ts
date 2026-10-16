import {
  CategoryOverride,
  CategoryRewrite,
  SheetTransaction,
  SpreadsheetService,
  SpreadsheetPermissionError,
  SuggestionRewrite,
  TransactionRewrite,
} from './types';
import { ParsedTransaction } from '../llm/types';
import { BUILT_IN_CATEGORIES, CategoryEntry, isCategory } from '../categories/category-list';
import { sameMerchant } from '../analytics/merchant';
import { CategorySpelling, withSuggestedCategory } from '../categories/open-categories';

// In-memory sheet. Rows are stored as the sheet would hold them: a fixed
// timestamp per append and a row number (header is row 1, data from row 2).
export class MockSpreadsheetService implements SpreadsheetService {
  private rows: SheetTransaction[] = [];
  private overrides: CategoryOverride[] = [];
  // null until the first read creates and seeds the Categories sheet.
  private categories: CategoryEntry[] | null = null;
  // null until the first record creates the CategorySpellings sheet.
  private spellings: CategorySpelling[] | null = null;
  private shouldFail = false;

  async appendTransaction(data: ParsedTransaction[], at?: Date): Promise<void> {
    this.failIfAsked();
    const date = at ?? new Date();
    for (const t of data) {
      // A blank F reads back as no suggestion, as it does from the sheet.
      this.rows.push(
        withSuggestedCategory({ ...t, date, row: this.rows.length + 2 }, t.suggestedCategory)
      );
    }
  }

  async readTransactions(): Promise<SheetTransaction[]> {
    this.failIfAsked();
    return this.rows.map((row) => ({ ...row, date: new Date(row.date) }));
  }

  async readCategories(): Promise<CategoryEntry[]> {
    this.failIfAsked();
    this.categories ??= BUILT_IN_CATEGORIES.map((c) => ({ ...c }));
    return this.categories.map((c) => ({ ...c }));
  }

  async rewriteCategories(rewrites: CategoryRewrite[]): Promise<void> {
    this.failIfAsked();
    for (const { row, category } of rewrites) {
      const target = this.rows[row - 2];
      if (!target) throw new Error(`No sheet row ${row}`);
      this.rows[row - 2] = { ...target, category };
    }
  }

  // Tests also call this to stand for a Category added by hand in the sheet.
  async addCategory(entry: CategoryEntry): Promise<void> {
    await this.readCategories();
    this.categories!.push({ ...entry });
  }

  async rewriteSuggestions(rewrites: SuggestionRewrite[]): Promise<void> {
    this.failIfAsked();
    for (const { row, category, suggestedCategory } of rewrites) {
      const target = this.rows[row - 2];
      if (!target) throw new Error(`No sheet row ${row}`);
      this.rows[row - 2] = withSuggestedCategory(
        category !== undefined ? { ...target, category } : target,
        suggestedCategory
      );
    }
  }

  async rewriteTransaction(row: number, rewrite: TransactionRewrite): Promise<void> {
    this.failIfAsked();
    const target = this.rows[row - 2];
    if (!target) throw new Error(`No sheet row ${row}`);
    this.rows[row - 2] = { ...target, ...rewrite, date: new Date(rewrite.date) };
  }

  async deleteTransactionRow(row: number): Promise<void> {
    this.failIfAsked();
    if (!this.rows[row - 2]) throw new Error(`No sheet row ${row}`);
    this.rows.splice(row - 2, 1);
    this.rows = this.rows.map((t, i) => ({ ...t, row: i + 2 }));
  }

  async readCategoryOverrides(categories: readonly string[]): Promise<CategoryOverride[]> {
    this.failIfAsked();
    return this.overrides
      .filter((o) => isCategory(o.category, categories))
      .map((o) => ({ ...o }));
  }

  async upsertCategoryOverride(override: CategoryOverride): Promise<void> {
    this.failIfAsked();
    const i = this.overrides.findIndex((o) => sameMerchant(o.merchant, override.merchant));
    if (i === -1) this.overrides.push({ ...override });
    else this.overrides[i] = { ...override };
  }

  async readCategorySpellings(): Promise<CategorySpelling[]> {
    this.failIfAsked();
    return (this.spellings ?? []).map((s) => ({ ...s }));
  }

  async recordCategorySpellings(spellings: CategorySpelling[]): Promise<void> {
    this.failIfAsked();
    this.spellings ??= [];
    for (const spelling of spellings) {
      const i = this.spellings.findIndex((s) => s.spelling === spelling.spelling);
      if (i === -1) this.spellings.push({ ...spelling });
      else this.spellings[i] = { ...spelling };
    }
  }

  private failIfAsked(): void {
    if (this.shouldFail) {
      throw new SpreadsheetPermissionError();
    }
  }

  // Test helper methods
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getRows(): SheetTransaction[] {
    return this.rows.map((row) => ({ ...row }));
  }

  clear(): void {
    this.rows = [];
    this.overrides = [];
    this.categories = null;
    this.spellings = null;
  }
}
