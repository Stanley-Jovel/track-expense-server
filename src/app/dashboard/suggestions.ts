import { getTransactions } from '@/app/services/spreadsheet/cached-transactions';
import { CategorySuggestion, groupSuggestions } from '@/app/services/categories/open-categories';

/**
 * The Category Suggestions waiting for review, oldest first: each with its
 * label (the first-seen spelling), its entries with their current Category,
 * and its total. The dashboard's banner and review deck render this. Reads
 * the same cached rows as the rest of the dashboard.
 */
export async function listSuggestions(): Promise<CategorySuggestion[]> {
  return groupSuggestions(await getTransactions());
}
