import OpenAI from 'openai';
import { LLMApiService, ParsedExpense, InvalidInputError } from './types';

export class OpenAIService implements LLMApiService {
  private client: OpenAI;
  private static SYSTEM_PROMPT = `You are a financial transaction parser. Parse the input text into structured data with these fields:
- motive: The reason or place of transaction
- amount: The numerical amount (without currency symbol)
- type: Either "Income" or "Expense"
- category: The category (e.g., Groceries, Entertainment, Income)

Respond ONLY with valid JSON. For invalid inputs, respond with {"error": "Invalid input format"}.`;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    this.client = new OpenAI({ apiKey });
  }

  async parseExpense(text: string): Promise<ParsedExpense> {
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: OpenAIService.SYSTEM_PROMPT },
          { role: "user", content: text }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      });

      const response = JSON.parse(completion.choices[0].message.content || '{}');
      
      if (response.error) {
        throw new InvalidInputError(response.error);
      }

      // Validate response structure
      if (!this.isValidParsedExpense(response)) {
        throw new InvalidInputError();
      }

      return response;
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      throw new Error('Failed to parse expense');
    }
  }

  private isValidParsedExpense(data: ParsedExpense): data is ParsedExpense {
    return (
      typeof data.motive === 'string' &&
      typeof data.amount === 'number' &&
      (data.type === 'Income' || data.type === 'Expense') &&
      typeof data.category === 'string'
    );
  }
} 