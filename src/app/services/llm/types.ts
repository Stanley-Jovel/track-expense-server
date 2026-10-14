import { z } from 'zod';
import type { Category } from '../categories/category-list';

export type ExpenseType = 'Income' | 'Expense';

export interface ParsedTransaction {
  motive: string;
  amount: number;
  type: ExpenseType;
  category: Category;
  /**
   * A new Category the LLM suggests when nothing on the list is a clear fit
   * (Expenses only). Stored in column F; see GLOSSARY.md: Category Suggestion.
   */
  suggestedCategory?: string;
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
        // A new Category, only when nothing on the list is a clear fit, else
        // null. Nullable rather than optional: Groq's strict structured
        // output rejects a schema whose properties aren't all required.
        suggested_category: z.string().nullable(),
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

\`suggested_category\` is for growing the list. Set it ONLY when the transaction is an Expense AND none of the categories below is a clear fit (you had to settle for a loose match such as "Shopping — General" or "Transfers"). Then name the kind of expense it is: a short, general category of 1-3 words in Title Case, like "Pet Supplies" or "Car Payment". Never a merchant, store, brand or person's name, and never a name already on the list. In every other case, including all Income, set \`suggested_category\` to null.

Allowed categories:
- ${categories.join('\n- ')}`;
}
