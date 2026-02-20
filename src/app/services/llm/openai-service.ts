import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { BaseLLMService } from './base-llm-service';

export const EXPENSE_CATEGORIES = [
  'Groceries', 'Dining', 'Transportation', 'Housing', 'Utilities',
  'Healthcare', 'Entertainment', 'Shopping', 'Travel', 'Education',
  'Income', 'Other'
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const ParsedTransactionsSchema = z.object({
  parsed_transactions: z.array(
    z.object({
      motive: z.string(),
      amount: z.number(),
      type: z.enum(['Income', 'Expense']),
      category: z.enum(EXPENSE_CATEGORIES)
    }))
});

export class OpenAIService extends BaseLLMService {
  private client: OpenAI;

  protected readonly providerName = 'openai';
  protected readonly inputCostPer1M = 0; // Placeholder — actual cost is model-specific
  protected readonly outputCostPer1M = 0; // We don't log cost for OpenAI in this version

  constructor() {
    super();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async createCompletion(sanitized: string) {
    return this.client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: this.systemPrompt },
        { role: "user", content: sanitized }
      ],
      temperature: 0.1,
      response_format: zodResponseFormat(ParsedTransactionsSchema, 'parsed_transactions')
    });
  }
}
