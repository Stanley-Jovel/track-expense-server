import { SpreadsheetService, SpreadsheetPermissionError, Transaction } from './types';
import { ParsedTransaction } from '../llm/types';

export class MockSpreadsheetService implements SpreadsheetService {
  private rows: ParsedTransaction[] = [];
  private shouldFail = false;

  async appendTransaction(data: ParsedTransaction[]): Promise<void> {
    if (this.shouldFail) {
      throw new SpreadsheetPermissionError();
    }
    this.rows.push(...data);
  }

  async readTransactions(): Promise<Transaction[]> {
    if (this.shouldFail) {
      throw new SpreadsheetPermissionError();
    }
    return this.rows.map((row) => ({ ...row, date: new Date() }));
  }

  // Test helper methods
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getRows(): ParsedTransaction[] {
    return [...this.rows];
  }

  clear(): void {
    this.rows = [];
  }
} 