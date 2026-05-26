import { createGroq } from '@ai-sdk/groq';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAI } from '@ai-sdk/openai';
import { LLMApiService } from './types';
import { VercelAIService } from './vercel-ai-service';
import { FallbackLLMService, NamedLLMService } from './fallback-service';

const DEFAULT_MODELS = {
  groq: 'openai/gpt-oss-20b',
  deepseek: 'deepseek-chat',
  mistral: 'open-mistral-nemo',
  openai: 'gpt-4o-mini',
} as const;

function buildProductionService(): LLMApiService {
  const services: NamedLLMService[] = [];

  if (process.env.GROQ_API_KEY) {
    const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });
    services.push({
      name: 'groq',
      service: new VercelAIService(groq(DEFAULT_MODELS.groq), 'groq'),
    });
  }

  if (process.env.DEEPSEEK_API_KEY) {
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    services.push({
      name: 'deepseek',
      service: new VercelAIService(deepseek(DEFAULT_MODELS.deepseek), 'deepseek'),
    });
  }

  if (process.env.MISTRAL_API_KEY) {
    const mistral = createMistral({ apiKey: process.env.MISTRAL_API_KEY });
    services.push({
      name: 'mistral',
      service: new VercelAIService(mistral(DEFAULT_MODELS.mistral), 'mistral'),
    });
  }

  if (process.env.OPENAI_API_KEY) {
    const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
    services.push({
      name: 'openai',
      service: new VercelAIService(openai(DEFAULT_MODELS.openai), 'openai'),
    });
  }

  if (services.length === 0) {
    throw new Error(
      'No LLM provider configured. Set at least one of GROQ_API_KEY, DEEPSEEK_API_KEY, MISTRAL_API_KEY, OPENAI_API_KEY.'
    );
  }

  return new FallbackLLMService(services);
}

export class LLMServiceFactory {
  static create(): LLMApiService {
    return buildProductionService();
  }
}
