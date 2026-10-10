import { FallbackLLMService, NamedLLMService } from '@/app/services/llm/fallback-service';
import { InvalidInputError, ParsedTransaction } from '@/app/services/llm/types';

const TXN: ParsedTransaction = {
  motive: 'Coffee',
  amount: 7,
  type: 'Expense',
  category: 'Coffee & Quick Bites',
};

function provider(
  name: string,
  impl: () => Promise<ParsedTransaction[]>
): NamedLLMService & { calls: () => number } {
  const fn = jest.fn(impl);
  return { name, service: { parseTransaction: fn }, calls: () => fn.mock.calls.length };
}

const ok = (name: string) => provider(name, async () => [TXN]);
const broken = (name: string) =>
  provider(name, async () => {
    throw new Error(`${name}: Invalid API Key`);
  });

describe('FallbackLLMService', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses the first provider when it succeeds and does not call the rest', async () => {
    const first = ok('groq');
    const second = ok('deepseek');
    const svc = new FallbackLLMService([first, second]);

    await expect(svc.parseTransaction('Starbucks coffee $7')).resolves.toEqual([TXN]);
    expect(first.calls()).toBe(1);
    expect(second.calls()).toBe(0);
  });

  it('falls through failing providers in order until one succeeds', async () => {
    const chain = [broken('groq'), broken('deepseek'), broken('mistral'), ok('openai')];
    const svc = new FallbackLLMService(chain);

    await expect(svc.parseTransaction('Walmart groceries $52')).resolves.toEqual([TXN]);
    for (const p of chain) expect(p.calls()).toBe(1);
  });

  it('throws "All LLM providers failed" when every provider errors', async () => {
    const svc = new FallbackLLMService([broken('groq'), broken('deepseek')]);

    await expect(svc.parseTransaction('Whole Foods $87')).rejects.toThrow(
      'All LLM providers failed'
    );
  });

  it('rethrows InvalidInputError so the route can return 400 instead of 500', async () => {
    const invalid = provider('groq', async () => {
      throw new InvalidInputError();
    });
    const svc = new FallbackLLMService([invalid]);

    await expect(svc.parseTransaction('asdfgh')).rejects.toBeInstanceOf(InvalidInputError);
  });

  it('requires at least one provider', () => {
    expect(() => new FallbackLLMService([])).toThrow(
      'FallbackLLMService requires at least one provider'
    );
  });
});
