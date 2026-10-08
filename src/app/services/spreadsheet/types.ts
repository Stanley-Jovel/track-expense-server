import { ParsedTransaction, ExpenseType } from '../llm/types';

// A transaction read back from the sheet. `category` is a plain string rather
// than ExpenseCategory: the sheet is the source of truth and may hold values
// written before the current category list existed.
export interface Transaction {
  date: Date;
  motive: string;
  amount: number;
  type: ExpenseType;
  category: string;
}

export interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[]): Promise<void>;
  readTransactions(): Promise<Transaction[]>;
}

export class SpreadsheetReadError extends Error {
  constructor(message: string = 'Failed to read from spreadsheet') {
    super(message);
    this.name = 'SpreadsheetReadError';
  }
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