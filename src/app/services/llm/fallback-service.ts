import { InvalidInputError, LLMApiService, ParsedTransaction } from './types';

export interface NamedLLMService {
  name: string;
  service: LLMApiService;
}

export class FallbackLLMService implements LLMApiService {
  constructor(private readonly services: NamedLLMService[]) {
    if (services.length === 0) {
      throw new Error('FallbackLLMService requires at least one provider');
    }
  }

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    let lastError: unknown;

    for (const { name, service } of this.services) {
      try {
        return await service.parseTransaction(text);
      } catch (err) {
        console.warn(`[LLM fallback] ${name} failed:`, err);
        lastError = err;
      }
    }

    if (lastError instanceof InvalidInputError) {
      throw lastError;
    }
    throw new Error('All LLM providers failed');
  }
}
