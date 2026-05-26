import { generateObject, type LanguageModel } from 'ai';
import {
  InvalidInputError,
  LLMApiService,
  ParsedTransaction,
  ParsedTransactionsSchema,
  SYSTEM_PROMPT,
} from './types';

export class VercelAIService implements LLMApiService {
  constructor(
    private readonly model: LanguageModel,
    public readonly providerName: string
  ) {}

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    const { object } = await generateObject({
      model: this.model,
      schema: ParsedTransactionsSchema,
      system: SYSTEM_PROMPT,
      prompt: text,
      temperature: 0.1,
    });

    if (!object.parsed_transactions || object.parsed_transactions.length === 0) {
      throw new InvalidInputError();
    }

    return object.parsed_transactions;
  }
}
