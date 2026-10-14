import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { LLMServiceFactory, InvalidInputError } from '@/app/services/llm';
import {
  SpreadsheetServiceFactory,
  SpreadsheetWriteError,
  CategoryOverride,
} from '@/app/services/spreadsheet';
import { ParsedTransaction } from '@/app/services/llm/types';
import { merchantName, sameMerchant } from '@/app/services/analytics/merchant';

// A Category Override replaces the LLM's Category for every Expense whose
// Motive clusters to the overridden Merchant (see GLOSSARY.md). Income keeps
// its Category: a refund from a Merchant is still Income.
function applyCategoryOverrides(
  transactions: ParsedTransaction[],
  overrides: CategoryOverride[]
): ParsedTransaction[] {
  return transactions.map((t) => {
    if (t.type !== 'Expense') return t;
    const merchant = merchantName(t.motive);
    const override = overrides.find((o) => sameMerchant(o.merchant, merchant));
    return override ? { ...t, category: override.category } : t;
  });
}

export async function POST(request: Request) {
  try {
    const body: { transaction: string } = await request.json();
    const transaction = body.transaction;

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

    try {
      const llmParsed = await llmService.parseTransaction(transaction);
      // A correction-memory problem must never lose a Transaction: if the
      // overrides can't be read, log it and keep the LLM's Categories.
      let overrides: CategoryOverride[] = [];
      try {
        overrides = await spreadsheetService.readCategoryOverrides();
      } catch (error) {
        console.error('Failed to read Category Overrides; using LLM categories:', error);
      }
      const parsedData = applyCategoryOverrides(llmParsed, overrides);
      await spreadsheetService.appendTransaction(parsedData);

      // The dashboard caches sheet rows (tagged unstable_cache) and the page
      // itself (ISR); bust both so the new transaction shows up immediately.
      try {
        revalidateTag('sheet-transactions');
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