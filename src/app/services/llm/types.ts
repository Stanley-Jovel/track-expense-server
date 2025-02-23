export type ExpenseType = 'Income' | 'Expense';

export interface ParsedTransaction {
  motive: string;
  amount: number;
  type: ExpenseType;
  category: string;
}

export interface LLMApiService {
  parseTransaction(text: string): Promise<ParsedTransaction[]>;
}

export class InvalidInputError extends Error {
  constructor(message: string = 'Invalid input format') {
    super(message);
    this.name = 'InvalidInputError';
  }
}