import { z } from 'zod';

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

export const ParsedTransactionsSchema = z.object({
  parsed_transactions: z.array(
    z.object({
      motive: z.string(),
      amount: z.number(),
      type: z.enum(['Income', 'Expense']),
      category: z.string(),
    })
  ),
});

export const SYSTEM_PROMPT = `You are a financial transaction parser. Parse the input text into structured data.
The input text may contain one or more transactions.

If the input cannot be interpreted as one or more financial transactions, return an empty parsed_transactions array.`;
