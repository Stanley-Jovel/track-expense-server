import type { ParsedTransaction } from '../llm/types';
import type { CategoryOverride, SpreadsheetService } from '../spreadsheet/types';
import { merchantName, sameMerchant } from '../analytics/merchant';
import { CategorySpelling, checkSuggestion, withSuggestedCategory } from './open-categories';

/**
 * Filing: where an LLM-parsed Transaction ends up before it's written. Shared
 * by ingest (POST /api/track-expense) and Add Entry's blank Category.
 */

// Drops a Transaction's suggested Category, so column F stays blank.
function withoutSuggestion(t: ParsedTransaction): ParsedTransaction {
  return withSuggestedCategory(t);
}

/**
 * The Category Overrides, or none if they can't be read: a correction-memory
 * problem must never lose a Transaction, so it's logged and the LLM's
 * Categories stand.
 */
export async function readCategoryOverridesOrNone(
  sheet: SpreadsheetService,
  categories: readonly string[]
): Promise<CategoryOverride[]> {
  try {
    return await sheet.readCategoryOverrides(categories);
  } catch (error) {
    console.error('Failed to read Category Overrides; using LLM categories:', error);
    return [];
  }
}

/** The Category Override for an Expense's Merchant, if the user saved one. */
export function overrideFor(
  t: Pick<ParsedTransaction, 'type' | 'motive'>,
  overrides: readonly CategoryOverride[]
): CategoryOverride | undefined {
  if (t.type !== 'Expense') return undefined;
  const merchant = merchantName(t.motive);
  return overrides.find((o) => sameMerchant(o.merchant, merchant));
}

// A Category Override replaces the LLM's Category for every Expense whose
// Motive clusters to the overridden Merchant (see GLOSSARY.md). Income keeps
// its Category: a refund from a Merchant is still Income. The user has
// already decided where that Merchant belongs, so an override also drops the
// LLM's suggestion, and Income never carries one.
function applyCategoryOverrides(
  transactions: ParsedTransaction[],
  overrides: readonly CategoryOverride[]
): ParsedTransaction[] {
  return transactions.map((t) => {
    if (t.type !== 'Expense') return withoutSuggestion(t);
    const override = overrideFor(t, overrides);
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

/**
 * Files LLM-parsed Transactions: Category Overrides first, then each
 * remaining suggestion is checked against the Category list and the recorded
 * Category Spellings. If the spellings can't be read, that's logged and every
 * suggestion waits in F (the respelling check still runs).
 */
export async function fileTransactions(
  transactions: ParsedTransaction[],
  categories: readonly string[],
  overrides: readonly CategoryOverride[],
  sheet: SpreadsheetService
): Promise<ParsedTransaction[]> {
  const overridden = applyCategoryOverrides(transactions, overrides);
  let spellings: CategorySpelling[] = [];
  if (overridden.some((t) => t.suggestedCategory)) {
    try {
      spellings = await sheet.readCategorySpellings();
    } catch (error) {
      console.error('Failed to read Category Spellings; skipping that check:', error);
    }
  }
  return applySuggestionChecks(overridden, categories, spellings);
}
