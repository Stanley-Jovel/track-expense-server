import { LLMApiService, ParsedTransaction, InvalidInputError } from './types';
import { ParsedTransactionsSchema } from './openai-service';

export abstract class BaseLLMService implements LLMApiService {
  protected abstract readonly systemPrompt: string;
  protected abstract readonly providerName: string;
  protected abstract readonly inputCostPer1M: number;
  protected abstract readonly outputCostPer1M: number;

  abstract createCompletion(sanitized: string): Promise<any>;

  async parseTransaction(text: string): Promise<ParsedTransaction[]> {
    try {
      const sanitized = this.sanitizeInput(text);
      if (sanitized === '') {
        throw new InvalidInputError('Transaction text cannot be empty');
      }

      const completion = await this.createCompletion(sanitized);
      const response = JSON.parse(completion.choices[0].message.content || '{}');

      if (response.error) {
        throw new InvalidInputError(response.error);
      }

      if (!this.isValidParsedExpense(response)) {
        throw new InvalidInputError();
      }

      this.logUsage(completion.usage);

      return response.parsed_transactions;
    } catch (error) {
      if (error instanceof InvalidInputError) {
        throw error;
      }
      console.error(
        `[${this.providerName.toUpperCase()}] Parse error:`,
        error instanceof Error ? error.message : String(error)
      );
      throw new Error('Failed to parse expense');
    }
  }

  protected sanitizeInput(text: string): string {
    return text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\[System[\s\S]*?\]/gi, '')
      .replace(/\{instruction[\s\S]*?\}/gi, '')
      .trim()
      .slice(0, 500);
  }

  protected logUsage(
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null | undefined
  ): void {
    const cost =
      ((usage?.prompt_tokens || 0) * this.inputCostPer1M) / 1_000_000 +
      ((usage?.completion_tokens || 0) * this.outputCostPer1M) / 1_000_000;
    console.log(
      `[LLM] provider=${this.providerName} input_tokens=${usage?.prompt_tokens ?? 0} output_tokens=${usage?.completion_tokens ?? 0} total_tokens=${usage?.total_tokens ?? 0} cost_usd=$${cost.toFixed(6)}`
    );
  }

  protected isValidParsedExpense(data: {
    parsed_transactions: ParsedTransaction[];
  }): data is { parsed_transactions: ParsedTransaction[] } {
    return (
      data != null &&
      Array.isArray(data.parsed_transactions) &&
      data.parsed_transactions.length > 0 &&
      data.parsed_transactions.every(
        (transaction: ParsedTransaction) =>
          typeof transaction.motive === 'string' &&
          typeof transaction.amount === 'number' &&
          (transaction.type === 'Income' || transaction.type === 'Expense') &&
          typeof transaction.category === 'string'
      )
    );
  }
}
