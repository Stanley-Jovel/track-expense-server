import { ParsedExpense } from '../llm/types';

export interface SpreadsheetService {
  writeExpense(data: ParsedExpense): Promise<void>;
}

export class SpreadsheetWriteError extends Error {
  constructor(message: string = 'Failed to write to spreadsheet') {
    super(message);
    this.name = 'SpreadsheetWriteError';
  }
}

export class SpreadsheetPermissionError extends SpreadsheetWriteError {
  constructor() {
    super('Permission denied');
    this.name = 'SpreadsheetPermissionError';
  }
} 