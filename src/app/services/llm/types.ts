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
  // Money Movement (excluded from dashboard Spending — see GLOSSARY.md)
  'Investments & Savings',
  'Transfers',
  // Fees are consumed money, so despite the banking flavor this is Spending.
  'Bank & FX Fees',
  // Income
  'Income',
] as const;

// The built-in Categories that don't count as Spending (Money Movement — see
// GLOSSARY.md). Income is excluded from Spending by its type, not by this set.
export const BUILT_IN_NOT_SPENDING: readonly string[] = ['Transfers', 'Investments & Savings'];

// A Category is any name on the Category list the caller passes in. The
// built-in list above is only a default the edges (ingest, the dashboard
// page, server actions) hand down; nothing else reads it directly.
export type ExpenseCategory = string;

/** Whether `category` is one of the given `categories`. */
export function isExpenseCategory(
  category: unknown,
  categories: readonly string[]
): category is ExpenseCategory {
  return categories.some((c) => c === category);
}

export interface ParsedTransaction {
  motive: string;
  amount: number;
  type: ExpenseType;
  category: ExpenseCategory;
}

export interface LLMApiService {
  parseTransaction(text: string, categories: readonly string[]): Promise<ParsedTransaction[]>;
}

export class InvalidInputError extends Error {
  constructor(message: string = 'Invalid input format') {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** The structured-output schema, its Category enum built from `categories`. */
export function parsedTransactionsSchema(categories: readonly string[]) {
  return z.object({
    parsed_transactions: z.array(
      z.object({
        motive: z.string(),
        amount: z.number(),
        type: z.enum(['Income', 'Expense']),
        // z.enum needs a non-empty tuple; the list always has at least Income.
        category: z.enum(categories as [string, ...string[]]),
      })
    ),
  });
}

/** The system prompt, its allowed list built from `categories`. */
export function systemPrompt(categories: readonly string[]): string {
  return `You are a financial transaction parser. Parse the input text into structured data.
The input text may contain one or more transactions.

If the input cannot be interpreted as one or more financial transactions, return an empty parsed_transactions array.

You MUST set \`category\` to exactly one of the values listed below. Do not invent, translate, abbreviate, or pluralize. If no category is a clear fit, choose the closest one — never leave it blank and never return a value outside the list.

Allowed categories:
- ${categories.join('\n- ')}`;
}
