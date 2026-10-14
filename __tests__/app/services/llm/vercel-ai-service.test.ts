import { MockLanguageModelV3 } from 'ai/test';
import { VercelAIService } from '@/app/services/llm/vercel-ai-service';
import { InvalidInputError } from '@/app/services/llm/types';
import { BUILT_IN_CATEGORY_NAMES } from '@/app/services/categories/category-list';

// A model that answers every prompt with `parsed_transactions`. Like a real
// provider bound by the schema, it always sends suggested_category (null
// unless the transaction says otherwise).
function modelReturning(transactions: object[]) {
  const parsed_transactions = transactions.map((t) => ({ suggested_category: null, ...t }));
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

    await expect(svc.parseTransaction('Dollarcity $1.50', BUILT_IN_CATEGORY_NAMES)).resolves.toEqual([expense(1.5)]);
  });

  it('returns a suggested Category, and none when the model sent null or blank', async () => {
    const svc = new VercelAIService(
      modelReturning([
        { ...expense(38.5), suggested_category: ' Pet Supplies ' },
        { ...expense(7), suggested_category: null },
        { ...expense(2), suggested_category: '' },
      ]),
      'mock'
    );

    const parsed = await svc.parseTransaction('PetSmart 38.50, coffee 7, gum 2', BUILT_IN_CATEGORY_NAMES);

    expect(parsed).toEqual([
      { ...expense(38.5), suggestedCategory: 'Pet Supplies' },
      expense(7),
      expense(2),
    ]);
    expect(parsed[1]).not.toHaveProperty('suggestedCategory');
  });

  it('rejects a $0 amount as invalid input instead of logging it', async () => {
    const svc = new VercelAIService(modelReturning([expense(0)]), 'mock');

    await expect(svc.parseTransaction('Dollarcity', BUILT_IN_CATEGORY_NAMES)).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('rejects a batch if any transaction has a non-positive amount', async () => {
    const svc = new VercelAIService(modelReturning([expense(1.5), expense(-2)]), 'mock');

    await expect(svc.parseTransaction('Dollarcity $1.50', BUILT_IN_CATEGORY_NAMES)).rejects.toBeInstanceOf(InvalidInputError);
  });
});

describe('VercelAIService provider options', () => {
  it('passes its provider options to the model call', async () => {
    const model = modelReturning([expense(1.5)]);
    const svc = new VercelAIService(model, 'deepseek', {
      deepseek: { thinking: { type: 'disabled' } },
    });

    await svc.parseTransaction('Dollarcity $1.50', BUILT_IN_CATEGORY_NAMES);

    expect(model.doGenerateCalls[0].providerOptions).toEqual({
      deepseek: { thinking: { type: 'disabled' } },
    });
  });
});
