import { SpreadsheetService } from './types';
import { GoogleSheetsService } from './google-sheets-service';
import { MockSpreadsheetService } from './mock-service';

export class SpreadsheetServiceFactory {
  static create(type: 'production' | 'mock' = 'production'): SpreadsheetService {
    switch (type) {
      case 'mock':
        return new MockSpreadsheetService();
      case 'production':
        return new GoogleSheetsService();
      default:
        throw new Error(`Unknown service type: ${type}`);
    }
  }
} 