import { MockLanguageModelV3 } from 'ai/test';
import { VercelAIService } from '@/app/services/llm/vercel-ai-service';
import { EXPENSE_CATEGORIES, InvalidInputError } from '@/app/services/llm/types';

// A model that answers every prompt with `parsed_transactions`.
function modelReturning(parsed_transactions: unknown[]) {
  return new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: 'text', text: JSON.stringify({ parsed_transactions }) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    }),
  });
}

const expense = (amount: number) => ({
  motive: 'Dollarcity, Opico, La Libertad',
  amount,
  type: 'Expense',
  category: 'Shopping — General',
});

describe('VercelAIService', () => {
  it('returns the parsed transactions', async () => {
    const svc = new VercelAIService(modelReturning([expense(1.5)]), 'mock');

    await expect(svc.parseTransaction('Dollarcity $1.50', EXPENSE_CATEGORIES)).resolves.toEqual([expense(1.5)]);
  });

  it('rejects a $0 amount as invalid input instead of logging it', async () => {
    const svc = new VercelAIService(modelReturning([expense(0)]), 'mock');

    await expect(svc.parseTransaction('Dollarcity', EXPENSE_CATEGORIES)).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('rejects a batch if any transaction has a non-positive amount', async () => {
    const svc = new VercelAIService(modelReturning([expense(1.5), expense(-2)]), 'mock');

    await expect(svc.parseTransaction('Dollarcity $1.50', EXPENSE_CATEGORIES)).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe('VercelAIService provider options', () => {
  it('passes its provider options to the model call', async () => {
    const model = modelReturning([expense(1.5)]);
    const svc = new VercelAIService(model, 'deepseek', {
      deepseek: { thinking: { type: 'disabled' } },
    });

    await svc.parseTransaction('Dollarcity $1.50', EXPENSE_CATEGORIES);

    expect(model.doGenerateCalls[0].providerOptions).toEqual({
      deepseek: { thinking: { type: 'disabled' } },
    });
  });
});
