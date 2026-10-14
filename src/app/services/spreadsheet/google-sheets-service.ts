import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import {
  SpreadsheetService,
  SpreadsheetWriteError,
  SpreadsheetPermissionError,
  SpreadsheetReadError,
  SheetTransaction,
  CategoryOverride,
  CategoryRewrite,
  SuggestionRewrite,
  TransactionRewrite,
} from './types';
import { BUILT_IN_CATEGORIES, CategoryEntry, ParsedTransaction, isExpenseCategory } from '../llm/types';
import { dateToSerial, parseTransactionRows } from './parse-row';
import { sameMerchant } from '../analytics/merchant';

const OVERRIDES_HEADER = ['Merchant', 'Category', 'Updated-at'];
const CATEGORIES_HEADER = ['Category', 'Counts as Spending', 'Added-at'];

// A hand-edited Spending flag: an unticked checkbox reads as false, a typed
// FALSE as the string. Anything else (including blank) counts as Spending.
function countsAsSpending(flag: unknown): boolean {
  if (flag === false) return false;
  return !(typeof flag === 'string' && flag.trim().toUpperCase() === 'FALSE');
}

/**
 * The sheet row number of the first row in a values.get response, read from
 * the A1 range it reports ("Transactions!A2:E700" → 2). Falls back to
 * `fallback` (the row the request started at) if the range is absent.
 */
function firstRowOf(range: string | null | undefined, fallback: number): number {
  const match = range?.match(/![A-Z]+(\d+)/);
  return match ? Number(match[1]) : fallback;
}

export class GoogleSheetsService implements SpreadsheetService {
  private auth: JWT;
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private sheetNames = {
    transactions: process.env.GOOGLE_SHEETS_TRANSACTIONS_SHEET_NAME || 'Transactions',
    categories: 'Categories',
    overrides: 'CategoryOverrides',
  }

  constructor() {
    const credentials = {
      client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!credentials.client_email || !credentials.private_key || !spreadsheetId) {
      throw new Error('Missing required Google Sheets credentials');
    }

    this.auth = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    this.sheets = google.sheets({ version: 'v4' });
    this.spreadsheetId = spreadsheetId;
  }

  private formatDate(date: Date): string {
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  async appendTransaction(transactions: ParsedTransaction[]): Promise<void> {
    try {
      const currentTimestamp = this.formatDate(new Date());

      const rows = transactions.map(transaction => [
        currentTimestamp,
        transaction.motive,
        transaction.amount.toString(),
        transaction.type,
        transaction.category,
        // F: Suggested Category, waiting for review (see GLOSSARY.md).
        transaction.suggestedCategory ?? '',
      ]);

      await this.sheets.spreadsheets.values.append({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.transactions}!A:F`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async readTransactions(): Promise<SheetTransaction[]> {
    try {
      // A2 skips the header row. UNFORMATTED_VALUE + SERIAL_NUMBER returns
      // date serials and plain-number amounts; the FORMATTED date strings in
      // this sheet come in inconsistent formats and are unsafe to parse.
      const res = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.transactions}!A2:F`,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = res.data.values ?? [];
      const { transactions, skippedRowCount } = parseTransactionRows(
        rows,
        firstRowOf(res.data.range, 2)
      );

      if (skippedRowCount > 0) {
        console.warn(
          `readTransactions: skipped ${skippedRowCount} malformed row(s) of ${rows.length}`
        );
      }

      return transactions;
    } catch (error: unknown) {
      throw new SpreadsheetReadError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async readCategories(): Promise<CategoryEntry[]> {
    try {
      if (!(await this.hasSheet(this.sheetNames.categories))) {
        return await this.createCategoriesSheet();
      }
      const res = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.categories}!A2:C`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      // The sheet is hand-editable: skip blank names and keep the first row
      // of a repeated one.
      const categories: CategoryEntry[] = [];
      for (const [name, flag] of res.data.values ?? []) {
        const trimmed = typeof name === 'string' ? name.trim() : '';
        if (trimmed && !categories.some((c) => c.name === trimmed)) {
          categories.push({ name: trimmed, countsAsSpending: countsAsSpending(flag) });
        }
      }
      if (categories.length === 0) {
        throw new Error('The Categories sheet holds no Categories');
      }
      return categories;
    } catch (error: unknown) {
      throw new SpreadsheetReadError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async rewriteCategories(rewrites: CategoryRewrite[]): Promise<void> {
    if (rewrites.length === 0) return;
    try {
      // Column E is Category; each range is exactly one cell, so no other
      // column of an existing row can be touched.
      await this.sheets.spreadsheets.values.batchUpdate({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: rewrites.map(({ row, category }) => ({
            range: `${this.sheetNames.transactions}!E${row}`,
            values: [[category]],
          })),
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async addCategory(entry: CategoryEntry): Promise<void> {
    try {
      // Reading first creates and seeds the sheet if it's missing.
      await this.readCategories();
      await this.sheets.spreadsheets.values.append({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.categories}!A:C`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[entry.name, entry.countsAsSpending, new Date().toISOString()]],
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async rewriteSuggestions(rewrites: SuggestionRewrite[]): Promise<void> {
    if (rewrites.length === 0) return;
    try {
      // E is Category, F is Suggested Category; each range covers only the
      // cells being rewritten, so no other column of the row is touched.
      const tx = this.sheetNames.transactions;
      await this.sheets.spreadsheets.values.batchUpdate({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: rewrites.map(({ row, category, suggestedCategory }) =>
            category === undefined
              ? { range: `${tx}!F${row}`, values: [[suggestedCategory]] }
              : { range: `${tx}!E${row}:F${row}`, values: [[category, suggestedCategory]] }
          ),
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async rewriteTransaction(row: number, rewrite: TransactionRewrite): Promise<void> {
    try {
      // A:C is date, Motive, amount and E is Category; D (Type) is skipped.
      // RAW stores the date serial and amount as numbers, as UNFORMATTED
      // reads expect, and keeps the cells' existing date format.
      await this.sheets.spreadsheets.values.batchUpdate({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            {
              range: `${this.sheetNames.transactions}!A${row}:C${row}`,
              values: [[dateToSerial(rewrite.date), rewrite.motive, rewrite.amount]],
            },
            {
              range: `${this.sheetNames.transactions}!E${row}`,
              values: [[rewrite.category]],
            },
          ],
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async deleteTransactionRow(row: number): Promise<void> {
    try {
      // deleteDimension addresses the sheet by its numeric id, not its title.
      const res = await this.sheets.spreadsheets.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties(sheetId,title)',
      });
      const sheetId = res.data.sheets?.find(
        (sheet) => sheet.properties?.title === this.sheetNames.transactions
      )?.properties?.sheetId;
      if (sheetId == null) {
        throw new Error(`No sheet named ${this.sheetNames.transactions}`);
      }
      // 0-based and end-exclusive: sheet row N is index N-1.
      await this.sheets.spreadsheets.batchUpdate({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row },
              },
            },
          ],
        },
      });
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  async readCategoryOverrides(categories: readonly string[]): Promise<CategoryOverride[]> {
    try {
      const { rows } = await this.readOverrideRows({ createIfMissing: false });
      // The sheet is hand-editable, so a row may hold a Category the rest of
      // the app doesn't know; such a row is skipped (the LLM's guess is safer).
      return rows.flatMap(([merchant, category, updatedAt]) =>
        typeof merchant === 'string' && merchant && isExpenseCategory(category, categories)
          ? [{ merchant, category, updatedAt: String(updatedAt ?? '') }]
          : []
      );
    } catch (error: unknown) {
      throw new SpreadsheetReadError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async upsertCategoryOverride(override: CategoryOverride): Promise<void> {
    try {
      const { rows, firstRow } = await this.readOverrideRows({ createIfMissing: true });
      const values = [[override.merchant, override.category, override.updatedAt]];
      const index = rows.findIndex(
        ([merchant]) => typeof merchant === 'string' && sameMerchant(merchant, override.merchant)
      );

      if (index === -1) {
        await this.sheets.spreadsheets.values.append({
          auth: this.auth,
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetNames.overrides}!A:C`,
          valueInputOption: 'RAW',
          requestBody: { values },
        });
      } else {
        const row = firstRow + index;
        await this.sheets.spreadsheets.values.update({
          auth: this.auth,
          spreadsheetId: this.spreadsheetId,
          range: `${this.sheetNames.overrides}!A${row}:C${row}`,
          valueInputOption: 'RAW',
          requestBody: { values },
        });
      }
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  // Data rows of the CategoryOverrides sheet, with the sheet row number of
  // the first one. A missing sheet (checked against the spreadsheet's sheet
  // titles) reads as no overrides; with createIfMissing it is created, with
  // its header row, ready for the first upsert.
  private async readOverrideRows({
    createIfMissing,
  }: {
    createIfMissing: boolean;
  }): Promise<{ rows: unknown[][]; firstRow: number }> {
    if (!(await this.hasSheet(this.sheetNames.overrides))) {
      if (createIfMissing) await this.createOverridesSheet();
      return { rows: [], firstRow: 2 };
    }
    const res = await this.sheets.spreadsheets.values.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetNames.overrides}!A2:C`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    return { rows: res.data.values ?? [], firstRow: firstRowOf(res.data.range, 2) };
  }

  private async hasSheet(title: string): Promise<boolean> {
    const res = await this.sheets.spreadsheets.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      fields: 'sheets.properties.title',
    });
    return (res.data.sheets ?? []).some((sheet) => sheet.properties?.title === title);
  }

  private async createOverridesSheet(): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: this.sheetNames.overrides } } }],
      },
    });
    await this.sheets.spreadsheets.values.update({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetNames.overrides}!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: { values: [OVERRIDES_HEADER] },
    });
  }

  // Creates the Categories sheet and seeds it with the built-in list, so the
  // dashboard's Spending is unchanged on the day it appears.
  private async createCategoriesSheet(): Promise<CategoryEntry[]> {
    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: this.sheetNames.categories } } }],
      },
    });
    const addedAt = new Date().toISOString();
    const seed = BUILT_IN_CATEGORIES.map((c) => [c.name, c.countsAsSpending, addedAt]);
    await this.sheets.spreadsheets.values.update({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetNames.categories}!A1:C${seed.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [CATEGORIES_HEADER, ...seed] },
    });
    return BUILT_IN_CATEGORIES.map((c) => ({ ...c }));
  }

  private toWriteError(error: unknown): SpreadsheetWriteError {
    if (error instanceof Error && error.message.includes('permission')) {
      return new SpreadsheetPermissionError();
    }
    return new SpreadsheetWriteError(
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
