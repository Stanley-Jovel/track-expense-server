/**
 * The unstable_cache tags behind the dashboard (see cached-transactions):
 * the Transactions rows and the Category list. Every write busts both, so a
 * hand edit to either sheet also shows up on the next refresh.
 */
export const TRANSACTIONS_CACHE_TAG = 'sheet-transactions';
export const CATEGORIES_CACHE_TAG = 'sheet-categories';
export const SHEET_CACHE_TAGS = [TRANSACTIONS_CACHE_TAG, CATEGORIES_CACHE_TAG] as const;
