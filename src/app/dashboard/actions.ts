'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { SpreadsheetServiceFactory } from '@/app/services/spreadsheet/factory';
import { merchantName, sameMerchant } from '@/app/services/analytics/merchant';
import { EXPENSE_CATEGORIES } from '@/app/services/llm/types';

const CATEGORIES: readonly string[] = EXPENSE_CATEGORIES;

/**
 * Busts both cache layers behind the dashboard — the tagged unstable_cache
 * holding the sheet rows and the ISR copy of /dashboard — so the next render
 * re-reads the spreadsheet.
 */
export async function refreshDashboard(): Promise<void> {
  revalidateTag('sheet-transactions');
  revalidatePath('/dashboard');
}

export type CorrectionResult =
  | { ok: true; repaired: number }
  | { ok: false; error: string };

/**
 * Correct a Merchant's Category (see GLOSSARY.md: Category Override): save
 * the override, then repair the Category cell of every past row whose Motive
 * clusters to `merchant` and whose Category differs. Only the Category column
 * is ever rewritten. Returns how many rows were repaired.
 */
export async function correctMerchantCategory(
  merchant: string,
  category: string
): Promise<CorrectionResult> {
  if (!CATEGORIES.includes(category)) {
    return { ok: false, error: `"${category}" is not a known Category` };
  }

  try {
    const sheet = SpreadsheetServiceFactory.create();
    await sheet.upsertCategoryOverride({
      merchant,
      category,
      updatedAt: new Date().toISOString(),
    });

    const rows = await sheet.readTransactions();
    const rewrites = rows
      .filter((t) => sameMerchant(merchantName(t.motive), merchant))
      .filter((t) => t.category !== category)
      .map((t) => ({ row: t.row, category }));
    await sheet.rewriteCategories(rewrites);

    return { ok: true, repaired: rewrites.length };
  } catch (error) {
    console.error('correctMerchantCategory failed:', error);
    return { ok: false, error: `Couldn't save ${merchant} as ${category}. Try again.` };
  } finally {
    // Bust the same caches ingest does, even after a partial failure: the
    // override or some rows may already have been written.
    await refreshDashboard();
  }
}
