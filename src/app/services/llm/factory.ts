import { LLMApiService } from './types';
import { OpenAIService } from './openai-service';
import { MockLLMService } from './mock-service';
import { ZAIService } from './zai-service';
import { GroqService } from './groq-service';
import { MultiFallbackLLMService } from './multi-fallback-service';

export class LLMServiceFactory {
  static create(type: string = 'production'): LLMApiService {
    const provider = (process.env.LLM_PROVIDER || type).toLowerCase();
    switch (provider) {
      case 'z-ai':
      case 'zai':
        return new ZAIService();
      case 'groq':
        return new GroqService();
      case 'openai':
      case 'production':
        return new OpenAIService();
      case 'mock':
      case 'test':
        return new MockLLMService();
      default:
        console.warn(`[LLM] Unknown provider "${provider}", defaulting to z-ai`);
        return new ZAIService();
    }
  }

  static createWithFallbacks(
    primary: string = 'z-ai',
    fallback1: string = 'openai'
  ): LLMApiService {
    // Directly instantiate services without reading LLM_PROVIDER env var
    // (unlike create(), which respects the env var for single-provider mode)
    const createService = (provider: string): LLMApiService => {
      switch (provider.toLowerCase()) {
        case 'z-ai':
        case 'zai':
          return new ZAIService();
        case 'groq':
          return new GroqService();
        case 'openai':
        case 'production':
          return new OpenAIService();
        case 'mock':
        case 'test':
          return new MockLLMService();
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    };

    return new MultiFallbackLLMService(
      createService(primary),
      createService(fallback1)
    );
  }
}
