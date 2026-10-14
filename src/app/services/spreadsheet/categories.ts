import { BUILT_IN_CATEGORIES, CategoryEntry } from '../categories/category-list';
import { SpreadsheetService } from './types';

/**
 * The Category list from the Categories sheet, or the built-in list when the
 * sheet can't be read. A Category-list problem must never lose a Transaction
 * or break the dashboard, so the failure is logged and swallowed here.
 */
export async function readCategoriesOrBuiltIn(
  sheet: SpreadsheetService
): Promise<CategoryEntry[]> {
  try {
    return await sheet.readCategories();
  } catch (error) {
    console.error('Failed to read the Categories sheet; using the built-in list:', error);
    return BUILT_IN_CATEGORIES.map((c) => ({ ...c }));
  }
}
