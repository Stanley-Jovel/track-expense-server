import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { LLMServiceFactory, InvalidInputError } from '@/app/services/llm';
import {
  SpreadsheetServiceFactory,
  SpreadsheetWriteError,
  readCategoriesOrBuiltIn,
} from '@/app/services/spreadsheet';
import { categoryList } from '@/app/services/categories/category-list';
import {
  fileTransactions,
  readCategoryOverridesOrNone,
} from '@/app/services/categories/file-transactions';
import { SHEET_CACHE_TAGS } from '@/app/services/spreadsheet/cache-tags';

// The Shortcut sends `transaction` as text, but a Shortcuts Dictionary (e.g.
// the Wallet payment wrapped as { data: … }) arrives as a JSON object. The LLM
// prompt must be a string, so objects are passed along as their JSON text.
function transactionText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && Object.keys(value).length === 0) return '';
  return JSON.stringify(value);
}

export async function POST(request: Request) {
  try {
    const body: { transaction?: unknown } = await request.json();
    const transaction = transactionText(body.transaction);

    if (!transaction) {
      return NextResponse.json(
        { message: 'No input provided' },
        { status: 400 }
      );
    }

    // The raw text is the only way to diagnose a bad parse after the fact.
    console.log('[track-expense] input:', JSON.stringify(transaction));

    const llmService = LLMServiceFactory.create();
    const spreadsheetService = SpreadsheetServiceFactory.create();

    // Ingest is an edge: it decides which Category list the parse and the
    // override check use — the Categories sheet's, or the built-in list if
    // that sheet can't be read (logged, and the Transaction is still logged).
    const categories = categoryList(await readCategoriesOrBuiltIn(spreadsheetService)).names;

    try {
      const llmParsed = await llmService.parseTransaction(transaction, categories);
      // Overrides, then the suggestion checks; neither read failing can lose
      // the Transaction (see file-transactions).
      const overrides = await readCategoryOverridesOrNone(spreadsheetService, categories);
      const parsedData = await fileTransactions(llmParsed, categories, overrides, spreadsheetService);
      await spreadsheetService.appendTransaction(parsedData);

      // The dashboard caches sheet rows (tagged unstable_cache) and the page
      // itself (ISR); bust both so the new transaction shows up immediately.
      try {
        for (const tag of SHEET_CACHE_TAGS) revalidateTag(tag);
        revalidatePath('/dashboard');
      } catch {
        // Outside a Next request context (jest calls the handler directly)
        // there is no revalidation store; the dashboard then just falls back
        // to its 60s TTL.
      }

      const summary = parsedData
        .map(t => `${t.type === 'Expense' ? 'Spent' : 'Received'} ${t.amount} for ${t.motive}`)
        .join('\n');

      return NextResponse.json(
        { 
          message: summary,
          data: parsedData
        },
        { status: 200 }
      );
    } catch (error) {
      if (error instanceof InvalidInputError) {
        return NextResponse.json(
          { message: error.message },
          { status: 400 }
        );
      }
      if (error instanceof SpreadsheetWriteError) {
        return NextResponse.json(
          { message: 'Failed to log expense' },
          { status: 500 }
        );
      }
      throw error; // Re-throw unexpected errors
    }
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
} 