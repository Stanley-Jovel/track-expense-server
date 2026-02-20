import Groq from 'groq-sdk';
import { BaseLLMService } from './base-llm-service';
import { ParsedTransaction, InvalidInputError } from './types';
import { ParsedTransactionsSchema } from './openai-service';

export class GroqService extends BaseLLMService {
  private client: Groq;

  protected readonly providerName = 'groq';
  protected readonly inputCostPer1M = 0.27; // Groq pricing per 1M tokens
  protected readonly outputCostPer1M = 0.27; // Groq pricing per 1M tokens
  protected readonly systemPrompt = `You are a financial transaction parser. Parse the input text into structured data. The input text may contain one or more transactions.

You MUST categorize each transaction using ONLY one of these exact category values: Groceries, Dining, Transportation, Housing, Utilities, Healthcare, Entertainment, Shopping, Travel, Education, Income, Other.

Do not invent new categories. If a transaction does not fit any category, use 'Other'.

IMPORTANT: Return ONLY raw JSON with NO markdown code blocks, NO \`\`\`json markers. Return the JSON object directly.`;

  constructor() {
    super();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    this.client = new Groq({ apiKey });
  }

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    try {
      const sanitized = this.sanitizeInput(text);
      if (sanitized === '') {
        throw new InvalidInputError('Transaction text cannot be empty');
      }

      const completion = await this.client.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        temperature: 0.05,
        messages: [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: sanitized }
        ]
      });

      let content = completion.choices[0].message.content || '{}';

      // Strip markdown code blocks if present (Groq wraps JSON in ```json ... ```)
      if (content.includes('```json')) {
        // Extract JSON between ```json and ```
        const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          content = jsonMatch[1].trim();
        }
      }

      let response;
      try {
        response = JSON.parse(content);
      } catch (parseErr) {
        console.error('[GROQ] JSON parse failed. Content:', content);
        throw parseErr;
      }

      if (response.error) {
        throw new InvalidInputError(response.error);
      }

      // Groq returns "transactions" array, transform to "parsed_transactions" format
      if (response.transactions && Array.isArray(response.transactions)) {
        response.parsed_transactions = response.transactions.map(
          (t: { category: string; payee?: string; description?: string; amount: number }) => ({
            motive: t.payee || t.description || 'Unknown',
            amount: t.amount,
            type: 'Expense' as const,
            category: t.category
          })
        );
      }

      if (!this.isValidParsedExpense(response)) {
        throw new InvalidInputError('Response validation failed');
      }

      this.logUsage(completion.usage);

      return response.parsed_transactions;
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      console.error(
        `[${this.providerName.toUpperCase()}] Parse error:`,
        error instanceof Error ? error.message : String(error)
      );
      throw new Error('Failed to parse expense');
    }
  }

  async createCompletion(sanitized: string) {
    return this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.05,
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: sanitized }
      ]
    });
  }
}
