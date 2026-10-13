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
} from './types';
import { ParsedTransaction } from '../llm/types';
import { parseTransactionRows } from './parse-row';
import { sameMerchant } from '../analytics/merchant';

const OVERRIDES_HEADER = ['Merchant', 'Category', 'Updated-at'];

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
      ]);

      await this.sheets.spreadsheets.values.append({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.transactions}!A:E`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: rows,
        },
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('permission')) {
        throw new SpreadsheetPermissionError();
      }
      throw new SpreadsheetWriteError(
        error instanceof Error ? error.message : 'Unknown error'
      );
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
        range: `${this.sheetNames.transactions}!A2:E`,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      const rows = res.data.values ?? [];
      const { transactions, skippedRowCount } = parseTransactionRows(rows);

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

  async readCategoryOverrides(): Promise<CategoryOverride[]> {
    try {
      const rows = await this.readOverrideRows({ createIfMissing: false });
      return rows.flatMap(([merchant, category, updatedAt]) =>
        typeof merchant === 'string' && merchant && typeof category === 'string' && category
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
      const rows = await this.readOverrideRows({ createIfMissing: true });
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
        const row = index + 2; // data starts at A2
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

  // Data rows of the CategoryOverrides sheet. A missing sheet reads as no
  // overrides; the first upsert creates it (with its header row).
  private async readOverrideRows({
    createIfMissing,
  }: {
    createIfMissing: boolean;
  }): Promise<unknown[][]> {
    try {
      const res = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.overrides}!A2:C`,
        valueRenderOption: 'UNFORMATTED_VALUE',
      });
      return res.data.values ?? [];
    } catch (error: unknown) {
      if (!(error instanceof Error) || !error.message.includes('Unable to parse range')) {
        throw error;
      }
      if (createIfMissing) await this.createOverridesSheet();
      return [];
    }
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

  private toWriteError(error: unknown): SpreadsheetWriteError {
    if (error instanceof Error && error.message.includes('permission')) {
      return new SpreadsheetPermissionError();
    }
    return new SpreadsheetWriteError(
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}
