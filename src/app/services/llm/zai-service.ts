import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { BaseLLMService } from './base-llm-service';
import { ParsedTransactionsSchema } from './openai-service';

export class ZAIService extends BaseLLMService {
  private client: OpenAI;

  protected readonly providerName = 'z-ai';
  protected readonly inputCostPer1M = 0; // Z.ai free tier
  protected readonly outputCostPer1M = 0; // Z.ai free tier

  constructor() {
    super();
    const apiKey = process.env.ZAI_API_KEY;
    if (!apiKey) {
      throw new Error('ZAI_API_KEY environment variable is required');
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4/'
    });
  }

  async createCompletion(sanitized: string) {
    return this.client.chat.completions.create({
      model: 'GLM-4-Flash',
      temperature: 0.05,
      response_format: zodResponseFormat(ParsedTransactionsSchema, 'parsed_transactions'),
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: sanitized }
      ]
    });
  }
}
