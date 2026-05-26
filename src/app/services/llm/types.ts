import { z } from 'zod';

export type ExpenseType = 'Income' | 'Expense';

export const EXPENSE_CATEGORIES = [
  // Housing & Utilities
  'Rent / Mortgage',
  'Utilities',
  'Internet & Phone',
  'Home Maintenance & Furnishings',
  // Food
  'Groceries',
  'Dining Out',
  'Coffee & Quick Bites',
  // Getting Around
  'Local Transportation',
  'Travel',
  // Health
  'Medical & Pharmacy',
  'Fitness & Wellness',
  'Personal Care',
  // Lifestyle
  'Shopping — General',
  'Clothing',
  'Entertainment',
  'Subscriptions',
  // Obligations
  'Insurance',
  'Taxes',
  'Education',
  // People & Causes
  'Gifts',
  'Donations / Charity',
  // Money Movement
  'Investments & Savings',
  'Transfers',
  'Bank & FX Fees',
  // Income
  'Income',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ParsedTransaction {
  motive: string;
  amount: number;
  type: ExpenseType;
  category: ExpenseCategory;
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
      category: z.enum(EXPENSE_CATEGORIES),
    })
  ),
});

export const SYSTEM_PROMPT = `You are a financial transaction parser. Parse the input text into structured data.
The input text may contain one or more transactions.

If the input cannot be interpreted as one or more financial transactions, return an empty parsed_transactions array.

You MUST set \`category\` to exactly one of the values listed below. Do not invent, translate, abbreviate, or pluralize. If no category is a clear fit, choose the closest one — never leave it blank and never return a value outside the list.

Allowed categories:
- ${EXPENSE_CATEGORIES.join('\n- ')}`;
