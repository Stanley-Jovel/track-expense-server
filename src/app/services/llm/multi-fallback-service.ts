import { LLMApiService, ParsedTransaction, InvalidInputError } from './types';

export class MultiFallbackLLMService implements LLMApiService {
  private primary: LLMApiService;
  private fallback1: LLMApiService;

  constructor(primary: LLMApiService, fallback1: LLMApiService) {
    this.primary = primary;
    this.fallback1 = fallback1;
  }

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    try {
      return await this.primary.parseTransaction(text);
    } catch (error) {
      // Re-throw user input errors without trying fallbacks
      if (error instanceof InvalidInputError) {
        throw error;
      }
      console.warn(
        '[LLM] Primary provider failed, trying fallback:',
        error instanceof Error ? error.message : String(error)
      );
    }

    // Final fallback — let errors propagate
    return await this.fallback1.parseTransaction(text);
  }
}
