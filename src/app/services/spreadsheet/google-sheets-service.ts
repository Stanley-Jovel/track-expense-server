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
}