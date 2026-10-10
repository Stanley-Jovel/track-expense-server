import { unstable_cache } from 'next/cache';
import { SpreadsheetServiceFactory } from './factory';
import { Transaction } from './types';

// unstable_cache JSON-serializes its result, so Dates are cached as ISO
// strings and revived on the way out.
type SerializedTransaction = Omit<Transaction, 'date'> & { date: string };

const readSerialized = unstable_cache(
  async (): Promise<SerializedTransaction[]> => {
    const service = SpreadsheetServiceFactory.create();
    const transactions = await service.readTransactions();
    return transactions.map((t) => ({ ...t, date: t.date.toISOString() }));
  },
  ['sheet-transactions'],
  // The tag lets writers and the dashboard refresh button bust this cache
  // on demand (revalidateTag) before the 60s TTL expires.
  { revalidate: 60, tags: ['sheet-transactions'] }
);

/** All transactions from the sheet, cached for 60 seconds across requests. */
export async function getTransactions(): Promise<Transaction[]> {
  const serialized = await readSerialized();
  return serialized.map((t) => ({ ...t, date: new Date(t.date) }));
}
