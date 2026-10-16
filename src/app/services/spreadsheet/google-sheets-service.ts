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
import { ParsedTransaction } from '../llm/types';
import { BUILT_IN_CATEGORIES, CategoryEntry, isCategory } from '../categories/category-list';
import { dateToSerial, parseTransactionRows } from './parse-row';
import { sameMerchant } from '../analytics/merchant';
import { CategorySpelling, spellingKey } from '../categories/open-categories';

const OVERRIDES_HEADER = ['Merchant', 'Category', 'Updated-at'];
const CATEGORIES_HEADER = ['Category', 'Counts as Spending', 'Added-at'];
const SPELLINGS_HEADER = ['Spelling', 'Outcome', 'Target', 'Updated-at'];

// A hand-edited Spending flag: an unticked checkbox reads as false, a typed
// FALSE as the string. Anything else (including blank) counts as Spending.
function countsAsSpending(flag: unknown): boolean {
  if (flag === false) return false;
  return !(typeof flag === 'string' && flag.trim().toUpperCase() === 'FALSE');
}

// The column letter of a 1-based column number (up to Z).
function columnLetter(n: number): string {
  return String.fromCharCode(64 + n);
}

/** A side sheet: its title and its header row. */
interface DataSheet {
  title: string;
  header: string[];
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
    spellings: 'CategorySpellings',
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

  // `timeZone` is the server's own unless given; on Vercel that's UTC.
  private formatDate(date: Date, timeZone?: string): string {
    return date.toLocaleString('en-US', {
      timeZone,
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }

  async appendTransaction(transactions: ParsedTransaction[], at?: Date): Promise<void> {
    try {
      // A given timestamp is already UTC wall-clock, so it's written as UTC
      // wherever the server runs; now keeps ingest's long-standing format.
      const currentTimestamp = at ? this.formatDate(at, 'UTC') : this.formatDate(new Date());

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
        await this.createCategoriesSheet();
        return BUILT_IN_CATEGORIES.map((c) => ({ ...c }));
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
      // A missing sheet is created and seeded first, as a read would.
      if (!(await this.hasSheet(this.sheetNames.categories))) {
        await this.createCategoriesSheet();
      }
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
      const { rows } = await this.readDataRows(this.overridesSheet, { createIfMissing: false });
      // The sheet is hand-editable, so a row may hold a Category the rest of
      // the app doesn't know; such a row is skipped (the LLM's guess is safer).
      return rows.flatMap(([merchant, category, updatedAt]) =>
        typeof merchant === 'string' && merchant && isCategory(category, categories)
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
      const { rows, firstRow } = await this.readDataRows(this.overridesSheet, { createIfMissing: true });
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

  async readCategorySpellings(): Promise<CategorySpelling[]> {
    try {
      const { rows } = await this.readDataRows(this.spellingsSheet, { createIfMissing: false });
      // The sheet is hand-editable (deleting a row undoes an answer): skip
      // rows that don't hold a spelling and a known outcome, take each
      // spelling's key, and keep the first row of a repeated one.
      const spellings: CategorySpelling[] = [];
      for (const [spelling, outcome, target, updatedAt] of rows) {
        const key = typeof spelling === 'string' ? spellingKey(spelling) : '';
        const targetName = typeof target === 'string' ? target.trim() : '';
        if (!key || spellings.some((s) => s.spelling === key)) continue;
        if ((outcome === 'Alias' && targetName) || outcome === 'Dismissed') {
          spellings.push({ spelling: key, outcome, target: targetName, updatedAt: String(updatedAt ?? '') });
        }
      }
      return spellings;
    } catch (error: unknown) {
      throw new SpreadsheetReadError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  async recordCategorySpellings(spellings: CategorySpelling[]): Promise<void> {
    if (spellings.length === 0) return;
    try {
      const { rows, firstRow } = await this.readDataRows(this.spellingsSheet, { createIfMissing: true });
      const sheet = this.sheetNames.spellings;
      const updates: { range: string; values: string[][] }[] = [];
      const appends: string[][] = [];
      for (const s of spellings) {
        const values = [s.spelling, s.outcome, s.target, s.updatedAt];
        const index = rows.findIndex(
          ([spelling]) => typeof spelling === 'string' && spellingKey(spelling) === s.spelling
        );
        if (index === -1) appends.push(values);
        else {
          const row = firstRow + index;
          updates.push({ range: `${sheet}!A${row}:D${row}`, values: [values] });
        }
      }
      if (updates.length > 0) {
        await this.sheets.spreadsheets.values.batchUpdate({
          auth: this.auth,
          spreadsheetId: this.spreadsheetId,
          requestBody: { valueInputOption: 'RAW', data: updates },
        });
      }
      if (appends.length > 0) {
        await this.sheets.spreadsheets.values.append({
          auth: this.auth,
          spreadsheetId: this.spreadsheetId,
          range: `${sheet}!A:D`,
          valueInputOption: 'RAW',
          requestBody: { values: appends },
        });
      }
    } catch (error: unknown) {
      throw this.toWriteError(error);
    }
  }

  private get overridesSheet(): DataSheet {
    return { title: this.sheetNames.overrides, header: OVERRIDES_HEADER };
  }

  private get spellingsSheet(): DataSheet {
    return { title: this.sheetNames.spellings, header: SPELLINGS_HEADER };
  }

  // Data rows of a side sheet (CategoryOverrides, CategorySpellings), with
  // the sheet row number of the first one. A missing sheet (checked against
  // the spreadsheet's sheet titles) reads as no rows; with createIfMissing
  // it is created, with its header row, ready for the first write.
  private async readDataRows(
    { title, header }: DataSheet,
    { createIfMissing }: { createIfMissing: boolean }
  ): Promise<{ rows: unknown[][]; firstRow: number }> {
    if (!(await this.hasSheet(title))) {
      if (createIfMissing) await this.createSheet(title, header);
      return { rows: [], firstRow: 2 };
    }
    const res = await this.sheets.spreadsheets.values.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${title}!A2:${columnLetter(header.length)}`,
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

  // Adds a sheet with its header row and any initial `rows` under it.
  private async createSheet(title: string, header: string[], rows: unknown[][] = []): Promise<void> {
    await this.sheets.spreadsheets.batchUpdate({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title } } }],
      },
    });
    await this.sheets.spreadsheets.values.update({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${title}!A1:${columnLetter(header.length)}${rows.length + 1}`,
      valueInputOption: 'RAW',
      requestBody: { values: [header, ...rows] },
    });
  }

  // Creates the Categories sheet and seeds it with the built-in list, so the
  // dashboard's Spending is unchanged on the day it appears.
  private async createCategoriesSheet(): Promise<void> {
    const addedAt = new Date().toISOString();
    await this.createSheet(
      this.sheetNames.categories,
      CATEGORIES_HEADER,
      BUILT_IN_CATEGORIES.map((c) => [c.name, c.countsAsSpending, addedAt])
    );
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
