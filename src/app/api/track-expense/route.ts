import { NextResponse } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { LLMServiceFactory, InvalidInputError } from '@/app/services/llm';
import {
  SpreadsheetServiceFactory,
  SpreadsheetWriteError,
  CategoryOverride,
  readCategoriesOrBuiltIn,
} from '@/app/services/spreadsheet';
import { ParsedTransaction } from '@/app/services/llm/types';
import { merchantName, sameMerchant } from '@/app/services/analytics/merchant';
import { categoryList } from '@/app/services/categories/category-list';
import {
  CategorySpelling,
  checkSuggestion,
  withSuggestedCategory,
} from '@/app/services/categories/open-categories';
import { SHEET_CACHE_TAGS } from '@/app/services/spreadsheet/cache-tags';

// Drops a Transaction's suggested Category, so column F stays blank.
function withoutSuggestion(t: ParsedTransaction): ParsedTransaction {
  return withSuggestedCategory(t);
}

// A Category Override replaces the LLM's Category for every Expense whose
// Motive clusters to the overridden Merchant (see GLOSSARY.md). Income keeps
// its Category: a refund from a Merchant is still Income. The user has
// already decided where that Merchant belongs, so an override also drops the
// LLM's suggestion, and Income never carries one.
function applyCategoryOverrides(
  transactions: ParsedTransaction[],
  overrides: CategoryOverride[]
): ParsedTransaction[] {
  return transactions.map((t) => {
    if (t.type !== 'Expense') return withoutSuggestion(t);
    const merchant = merchantName(t.motive);
    const override = overrides.find((o) => sameMerchant(o.merchant, merchant));
    return override ? withoutSuggestion({ ...t, category: override.category }) : t;
  });
}

// A suggestion that means a Category the user already has (a respelling of
// it, or a spelling recorded as its Alias) is filed under that Category and
// F stays blank; a dismissed spelling is dropped; anything else waits in F.
function applySuggestionChecks(
  transactions: ParsedTransaction[],
  categories: readonly string[],
  spellings: readonly CategorySpelling[]
): ParsedTransaction[] {
  return transactions.map((t) => {
    if (!t.suggestedCategory) return t;
    const check = checkSuggestion(t.suggestedCategory, categories, spellings);
    switch (check.kind) {
      case 'file':
        return withoutSuggestion({ ...t, category: check.category });
      case 'drop':
        return withoutSuggestion(t);
      case 'suggest':
        return withSuggestedCategory(t, check.label);
    }
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

    // Ingest is an edge: it decides which Category list the parse and the
    // override check use — the Categories sheet's, or the built-in list if
    // that sheet can't be read (logged, and the Transaction is still logged).
    const categories = categoryList(await readCategoriesOrBuiltIn(spreadsheetService)).names;

    try {
      const llmParsed = await llmService.parseTransaction(transaction, categories);
      // A correction-memory problem must never lose a Transaction: if the
      // overrides can't be read, log it and keep the LLM's Categories.
      let overrides: CategoryOverride[] = [];
      try {
        overrides = await spreadsheetService.readCategoryOverrides(categories);
      } catch (error) {
        console.error('Failed to read Category Overrides; using LLM categories:', error);
      }
      const overridden = applyCategoryOverrides(llmParsed, overrides);
      // Same rule for spellings: if they can't be read, log it and let every
      // suggestion wait in F (the respelling check still runs).
      let spellings: CategorySpelling[] = [];
      if (overridden.some((t) => t.suggestedCategory)) {
        try {
          spellings = await spreadsheetService.readCategorySpellings();
        } catch (error) {
          console.error('Failed to read Category Spellings; skipping that check:', error);
        }
      }
      const parsedData = applySuggestionChecks(overridden, categories, spellings);
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