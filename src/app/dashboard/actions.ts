'use server';

import { revalidatePath, revalidateTag } from 'next/cache';

/**
 * Busts both cache layers behind the dashboard — the tagged unstable_cache
 * holding the sheet rows and the ISR copy of /dashboard — so the next render
 * re-reads the spreadsheet.
 */
export async function refreshDashboard(): Promise<void> {
  revalidateTag('sheet-transactions');
  revalidatePath('/dashboard');
}
