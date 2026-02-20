import { google } from 'googleapis';
import { JWT } from 'google-auth-library';
import { SpreadsheetService, SpreadsheetWriteError, SpreadsheetPermissionError } from './types';
import { ParsedTransaction } from '../llm/types';

export class GoogleSheetsService implements SpreadsheetService {
  private auth: JWT;
  private sheets: ReturnType<typeof google.sheets>;
  private spreadsheetId: string;
  private sheetNames = {
    transactions: 'Transactions',
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

  async getAllTransactions(): Promise<Array<{ timestamp: string; motive: string; amount: string; type: string; category: string }>> {
    const response = await this.sheets.spreadsheets.values.get({
      auth: this.auth,
      spreadsheetId: this.spreadsheetId,
      range: `${this.sheetNames.transactions}!A:E`,
    });
    const rows = response.data.values || [];
    return rows
      .filter(row => row.length >= 5 && row[0] !== 'Date' && row[0] !== 'Timestamp')
      .map(row => ({
        timestamp: row[0] || '',
        motive: row[1] || '',
        amount: row[2] || '',
        type: row[3] || '',
        category: row[4] || '',
      }));
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

      // Read-after-write verification (LLM-06)
      const readResponse = await this.sheets.spreadsheets.values.get({
        auth: this.auth,
        spreadsheetId: this.spreadsheetId,
        range: `${this.sheetNames.transactions}!A:E`,
      });
      const writtenRows = readResponse.data.values || [];
      const lastWrittenRow = writtenRows[writtenRows.length - 1];
      if (!lastWrittenRow || lastWrittenRow[1] !== rows[rows.length - 1][1]) {
        console.error('[SHEETS] Read-after-write verification FAILED: last row mismatch', {
          expected: rows[rows.length - 1],
          actual: lastWrittenRow ?? null,
        });
        throw new SpreadsheetWriteError('Write verification failed: data may not have been persisted');
      }
      console.log(`[SHEETS] Write verified: ${rows.length} row(s) appended successfully`);
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('permission')) {
        throw new SpreadsheetPermissionError();
      }
      throw new SpreadsheetWriteError(
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}