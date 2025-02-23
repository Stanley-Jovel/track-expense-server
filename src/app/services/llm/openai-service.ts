import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { LLMApiService, ParsedTransaction, InvalidInputError } from './types';

export const ParsedTransactionsSchema = z.object({
  parsed_transactions: z.array(
    z.object({
      motive: z.string(),
      amount: z.number(),
      type: z.enum(['Income', 'Expense']),
      category: z.string()
    }))
});

export class OpenAIService implements LLMApiService {
  private client: OpenAI;
  private static SYSTEM_PROMPT = `You are a financial transaction parser. Parse the input text into structured data.
  The input text may contain one or more transactions.

  For invalid inputs, respond with {"error": "Invalid input format"}.`;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: OpenAIService.SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        temperature: 0.1,
        response_format: zodResponseFormat(ParsedTransactionsSchema, 'parsed_transactions')
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');

      if (response.error) {
        throw new InvalidInputError(response.error);
      }

      // Validate response structure
      if (!this.isValidParsedExpense(response)) {
        throw new InvalidInputError();
      }

      return response.parsed_transactions;
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      throw new Error('Failed to parse expense');
    }
  }

  private isValidParsedExpense(data: { parsed_transactions: ParsedTransaction[] }): data is { parsed_transactions: ParsedTransaction[] } {
    return (
      data &&
      Array.isArray(data.parsed_transactions) &&
      data.parsed_transactions.length > 0 &&
      data.parsed_transactions.every((transaction: ParsedTransaction) =>
        typeof transaction.motive === 'string' &&
        typeof transaction.amount === 'number' &&
        (transaction.type === 'Income' || transaction.type === 'Expense') &&
        typeof transaction.category === 'string'
      )
    );
  }
} 