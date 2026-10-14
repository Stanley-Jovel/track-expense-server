import { getCategories, getTransactions } from '@/app/services/spreadsheet/cached-transactions';
import { categoryNames } from '@/app/services/llm/types';
import {
  CategorySuggestion,
  groupSuggestions,
  withHints,
} from '@/app/services/categories/open-categories';

/**
 * The Category Suggestions waiting for review, oldest first: each with its
 * label (the first-seen spelling), its entries with their current Category,
 * its total and its look-alike hint. The dashboard's banner and review deck
 * render this. Reads the same cached rows and Category list as the rest of
 * the dashboard.
 */
export async function listSuggestions(): Promise<CategorySuggestion[]> {
  const [rows, categories] = await Promise.all([getTransactions(), getCategories()]);
  return withHints(groupSuggestions(rows), categoryNames(categories));
}
