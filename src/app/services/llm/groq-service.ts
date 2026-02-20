import Groq from 'groq-sdk';
import { BaseLLMService } from './base-llm-service';
import { EXPENSE_CATEGORIES } from './openai-service';

export class GroqService extends BaseLLMService {
  private client: Groq;

  protected readonly providerName = 'groq';
  protected readonly inputCostPer1M = 0.27; // Groq pricing per 1M tokens
  protected readonly outputCostPer1M = 0.27; // Groq pricing per 1M tokens

  constructor() {
    super();
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY environment variable is required');
    }
    this.client = new Groq({ apiKey });
  }

  async createCompletion(sanitized: string) {
    const userPrompt = `${sanitized}\n\nRespond with JSON in this exact format: {"parsed_transactions": [{"motive": "string", "amount": number, "type": "Income" or "Expense", "category": "one of: ${EXPENSE_CATEGORIES.join(', ')}"}]}`;

    return this.client.chat.completions.create({
      model: 'mixtral-8x7b-32768',
      temperature: 0.05,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
  }
}
