import { generateObject, type LanguageModel } from 'ai';
import {
  InvalidInputError,
  LLMApiService,
  ParsedTransaction,
  parsedTransactionsSchema,
  systemPrompt,
} from './types';

type ProviderOptions = Parameters<typeof generateObject>[0]['providerOptions'];

export class VercelAIService implements LLMApiService {
  constructor(
    private readonly model: LanguageModel,
    public readonly providerName: string,
    private readonly providerOptions?: ProviderOptions
  ) {}

  async parseTransaction(
    text: string,
    categories: readonly string[]
  ): Promise<ParsedTransaction[]> {
    const { object } = await generateObject({
      model: this.model,
      schema: parsedTransactionsSchema(categories),
      system: systemPrompt(categories),
      prompt: text,
      temperature: 0.1,
      providerOptions: this.providerOptions,
    });

    if (!object.parsed_transactions || object.parsed_transactions.length === 0) {
      throw new InvalidInputError();
    }

    // A $0 (or negative) amount means the model couldn't find one in the
    // text and filled the field in anyway. Reject it so the next provider
    // gets a try, and so a made-up amount never reaches the sheet.
    if (object.parsed_transactions.some((t) => !(t.amount > 0))) {
      throw new InvalidInputError('No amount found in input');
    }

    // The schema's snake_case suggestion becomes ParsedTransaction's field,
    // present only when the model actually named one.
    return object.parsed_transactions.map(({ suggested_category, ...t }) => {
      const suggested = suggested_category?.trim();
      return suggested ? { ...t, suggestedCategory: suggested } : t;
    });
  }
}
