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
    fallback1: string = 'groq',
    fallback2: string = 'openai'
  ): LLMApiService {
    return new MultiFallbackLLMService(
      this.create(primary),
      this.create(fallback1),
      this.create(fallback2)
    );
  }
}
