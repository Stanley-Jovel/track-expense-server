import { POST } from '@/app/api/track-expense/route';
import { MockSpreadsheetService } from '@/app/services/spreadsheet/mock-service';
import type { ParsedTransaction } from '@/app/services/llm/types';

// The shape of `transaction` at the POST /api/track-expense seam. The iOS
// Shortcut used to send text; wrapping the Wallet payment in a Shortcuts
// Dictionary sends a JSON object instead, which must still reach the LLM as
// a string prompt.

const sheet = new MockSpreadsheetService();
jest.mock('@/app/services/spreadsheet/factory', () => ({
  SpreadsheetServiceFactory: { create: () => sheet },
}));

const prompts: unknown[] = [];
const parsed: ParsedTransaction[] = [
  { motive: 'Starbucks', amount: 5.4, type: 'Expense', category: 'Coffee & Quick Bites' },
];
jest.mock('@/app/services/llm/factory', () => ({
  LLMServiceFactory: {
    create: () => ({
      parseTransaction: async (text: unknown) => {
        prompts.push(text);
        return parsed;
      },
    }),
  },
}));

async function post(body: unknown) {
  const res = await POST(
    new Request('http://localhost/api/track-expense', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  sheet.clear();
  prompts.length = 0;
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('POST /api/track-expense — transaction input shape', () => {
  it('passes a text transaction to the LLM as is', async () => {
    const { status } = await post({ transaction: 'Starbucks $5.40' });

    expect(status).toBe(200);
    expect(prompts).toEqual(['Starbucks $5.40']);
  });

  it('passes a Dictionary transaction to the LLM as its JSON text', async () => {
    const { status, body } = await post({
      transaction: { data: { merchant: 'Starbucks', amount: '$5.40', card: 'Apple Card' } },
    });

    expect(status).toBe(200);
    expect(prompts).toEqual(['{"data":{"merchant":"Starbucks","amount":"$5.40","card":"Apple Card"}}']);
    expect(body.data).toEqual(parsed);
  });

  it.each([
    ['missing', {}],
    ['empty text', { transaction: '   ' }],
    ['empty Dictionary', { transaction: {} }],
    ['null', { transaction: null }],
  ])('rejects a %s transaction with 400', async (_, body) => {
    const { status, body: res } = await post(body);

    expect(status).toBe(400);
    expect(res.message).toBe('No input provided');
    expect(prompts).toEqual([]);
  });
});
