import { ParsedTransaction } from '../llm/types';

export interface SpreadsheetService {
  appendTransaction(data: ParsedTransaction[], requestId?: string): Promise<void>;
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

export class DuplicateRequestError extends Error {
  constructor(requestId: string) {
    super(`Duplicate request: ${requestId}`);
    this.name = 'DuplicateRequestError';
  }
}
