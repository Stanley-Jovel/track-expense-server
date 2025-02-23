import { LLMApiService, ParsedTransaction, InvalidInputError } from './types';

export class MockLLMService implements LLMApiService {
  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    // Example implementation for testing
    if (text.toLowerCase().includes('groceries')) {
      return [
        {
          motive: "Trader Joe's",
          amount: 45,
          type: 'Expense',
          category: 'Groceries'
        },
      ];
    }
    
    if (text.toLowerCase().includes('salary')) {
      return [
        {
          motive: 'Salary',
          amount: 1500,
          type: 'Income',
          category: 'Income'
        },
      ];
    }

    throw new InvalidInputError();
  }
} 