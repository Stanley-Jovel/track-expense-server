export type ExpenseType = 'Income' | 'Expense';

export interface ParsedExpense {
  motive: string;
  amount: number;
  type: ExpenseType;
  category: string;
}

export interface LLMApiService {
  parseExpense(text: string): Promise<ParsedExpense>;
}

export class InvalidInputError extends Error {
  constructor(message: string = 'Invalid input format') {
    super(message);
    this.name = 'InvalidInputError';
  }
}