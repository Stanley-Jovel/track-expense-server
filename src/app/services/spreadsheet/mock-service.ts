import {
  CategoryOverride,
  CategoryRewrite,
  SheetTransaction,
  SpreadsheetService,
  SpreadsheetPermissionError,
  TransactionRewrite,
} from './types';
import { ParsedTransaction } from '../llm/types';
import { sameMerchant } from '../analytics/merchant';

// In-memory sheet. Rows are stored as the sheet would hold them: a fixed
// timestamp per append and a row number (header is row 1, data from row 2).
export class MockSpreadsheetService implements SpreadsheetService {
  private rows: SheetTransaction[] = [];
  private overrides: CategoryOverride[] = [];
  private shouldFail = false;

  async appendTransaction(data: ParsedTransaction[]): Promise<void> {
    this.failIfAsked();
    const date = new Date();
    for (const t of data) {
      this.rows.push({ ...t, date, row: this.rows.length + 2 });
    }
  }

  async readTransactions(): Promise<SheetTransaction[]> {
    this.failIfAsked();
    return this.rows.map((row) => ({ ...row, date: new Date(row.date) }));
  }

  async rewriteCategories(rewrites: CategoryRewrite[]): Promise<void> {
    this.failIfAsked();
    for (const { row, category } of rewrites) {
      const target = this.rows[row - 2];
      if (!target) throw new Error(`No sheet row ${row}`);
      this.rows[row - 2] = { ...target, category };
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

  async readCategoryOverrides(): Promise<CategoryOverride[]> {
    this.failIfAsked();
    return this.overrides.map((o) => ({ ...o }));
  }

  async upsertCategoryOverride(override: CategoryOverride): Promise<void> {
    this.failIfAsked();
    const i = this.overrides.findIndex((o) => sameMerchant(o.merchant, override.merchant));
    if (i === -1) this.overrides.push({ ...override });
    else this.overrides[i] = { ...override };
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
  }
}
