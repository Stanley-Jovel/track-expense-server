import { unstable_cache } from 'next/cache';
import { SpreadsheetServiceFactory } from './factory';
import { SheetTransaction } from './types';
import { readCategoriesOrBuiltIn } from './categories';
import { CategoryEntry } from '../categories/category-list';
import { CATEGORIES_CACHE_TAG, TRANSACTIONS_CACHE_TAG } from './cache-tags';

// unstable_cache JSON-serializes its result, so Dates are cached as ISO
// strings and revived on the way out.
type SerializedTransaction = Omit<SheetTransaction, 'date'> & { date: string };

const readSerialized = unstable_cache(
  async (): Promise<SerializedTransaction[]> => {
    const service = SpreadsheetServiceFactory.create();
    const transactions = await service.readTransactions();
    return transactions.map((t) => ({ ...t, date: t.date.toISOString() }));
  },
  [TRANSACTIONS_CACHE_TAG],
  // The tag lets writers and the dashboard refresh button bust this cache
  // on demand (revalidateTag) before the 60s TTL expires.
  { revalidate: 60, tags: [TRANSACTIONS_CACHE_TAG] }
);

/** All transactions from the sheet, cached for 60 seconds across requests. */
export async function getTransactions(): Promise<SheetTransaction[]> {
  const serialized = await readSerialized();
  return serialized.map((t) => ({ ...t, date: new Date(t.date) }));
}

const readCategoryList = unstable_cache(
  async (): Promise<CategoryEntry[]> =>
    readCategoriesOrBuiltIn(SpreadsheetServiceFactory.create()),
  [CATEGORIES_CACHE_TAG],
  // Its own tag; every cache bust (ingest, the server actions, the refresh
  // button) busts it with the rows' (see SHEET_CACHE_TAGS), so hand edits to
  // the list show up too.
  { revalidate: 60, tags: [CATEGORIES_CACHE_TAG] }
);

/**
 * The Category list from the Categories sheet (the built-in list if it can't
 * be read), cached for 60 seconds across requests.
 */
export async function getCategories(): Promise<CategoryEntry[]> {
  return readCategoryList();
}
