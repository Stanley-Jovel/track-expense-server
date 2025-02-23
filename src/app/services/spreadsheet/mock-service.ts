import { SpreadsheetService, SpreadsheetPermissionError } from './types';
import { ParsedExpense } from '../llm/types';

export class MockSpreadsheetService implements SpreadsheetService {
  private rows: ParsedExpense[] = [];
  private shouldFail = false;

  async writeExpense(data: ParsedExpense): Promise<void> {
    if (this.shouldFail) {
      throw new SpreadsheetPermissionError();
    }
    this.rows.push(data);
  }

  // Test helper methods
  setShouldFail(fail: boolean): void {
    this.shouldFail = fail;
  }

  getRows(): ParsedExpense[] {
    return [...this.rows];
  }

  clear(): void {
    this.rows = [];
  }
} 