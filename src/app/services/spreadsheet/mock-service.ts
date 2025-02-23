import { SpreadsheetService, SpreadsheetPermissionError } from './types';
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