import { LLMApiService } from './types';
import { OpenAIService } from './openai-service';
import { MockLLMService } from './mock-service';

export class LLMServiceFactory {
  static create(type: 'production' | 'mock' = 'production'): LLMApiService {
    switch (type) {
      case 'mock':
        return new MockLLMService();
      case 'production':
        return new OpenAIService();
      default:
        throw new Error(`Unknown service type: ${type}`);
    }
  }
} 