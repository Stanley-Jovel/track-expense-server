import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import {
  SpreadsheetService,
  SpreadsheetWriteError,
  SpreadsheetPermissionError,
  SpreadsheetReadError,
  Transaction,
} from './types';
import { ParsedTransaction } from '../llm/types';
import { parseTransactionRows } from './parse-row';

export class GoogleSheetsService implements SpreadsheetService {
  private auth: JWT;
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private sheetNames = {
    transactions: process.env.GOOGLE_SHEETS_TRANSACTIONS_SHEET_NAME || 'Transactions',
    categories: 'Categories',
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

  async readTransactions(): Promise<Transaction[]> {
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
}