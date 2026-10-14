'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { SpreadsheetServiceFactory } from '@/app/services/spreadsheet';
import { merchantName, sameMerchant } from '@/app/services/analytics/merchant';
import { ExpenseCategory, isExpenseCategory } from '@/app/services/llm/types';

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
 * the override, then repair the Category cell of every past Expense row whose
 * Motive clusters to `merchant` and whose Category differs. Income rows are
 * never touched. Only the Category column is ever rewritten. Returns how many
 * rows were repaired. Safe to retry: a second run saves the same override and
 * repairs whatever rows are still wrong.
 */
export async function correctMerchantCategory(
  merchant: string,
  category: ExpenseCategory
): Promise<CorrectionResult> {
  // A server action is a public endpoint: re-check the closed list at runtime.
  if (!isExpenseCategory(category)) {
    return { ok: false, error: `"${category}" is not a known Category` };
  }

  let overrideSaved = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    await sheet.upsertCategoryOverride({
      merchant,
      category,
      updatedAt: new Date().toISOString(),
    });
    overrideSaved = true;

    const rows = await sheet.readTransactions();
    const rewrites = rows
      .filter((t) => t.type === 'Expense')
      .filter((t) => sameMerchant(merchantName(t.motive), merchant))
      .filter((t) => t.category !== category)
      .map((t) => ({ row: t.row, category }));
    await sheet.rewriteCategories(rewrites);

    return { ok: true, repaired: rewrites.length };
  } catch (error) {
    console.error('correctMerchantCategory failed:', error);
    return {
      ok: false,
      error: overrideSaved
        ? `Saved ${merchant} as ${category} for future expenses, but past rows couldn't be updated. Try again.`
        : `Couldn't save ${merchant} as ${category}. Try again.`,
    };
  } finally {
    // Bust the same caches ingest does, even after a partial failure: the
    // override or some rows may already have been written. Like ingest, a
    // revalidation problem is logged and never turns a save into a failure.
    try {
      await refreshDashboard();
    } catch (error) {
      console.error('correctMerchantCategory: dashboard revalidation failed:', error);
    }
  }
}

export type AmountCorrectionResult =
  | { ok: true; amount: number }
  | { ok: false; error: string };

/**
 * Correct the amount of one logged Transaction, e.g. when the parser got it
 * wrong. Only that row's amount cell is rewritten. `motive` and `previous`
 * are what the dashboard showed for the row: if the sheet no longer matches
 * them (the page is stale), nothing is written.
 */
export async function correctTransactionAmount(
  row: number,
  motive: string,
  previous: number,
  amount: number
): Promise<AmountCorrectionResult> {
  // A server action is a public endpoint: validate everything at runtime.
  if (!Number.isInteger(row) || row < 2) {
    return { ok: false, error: 'Unknown transaction.' };
  }
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than $0.' };
  }
  const cents = Math.round(amount * 100) / 100;

  let written = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    const current = (await sheet.readTransactions()).find((t) => t.row === row);
    if (!current || current.motive !== motive || current.amount !== previous) {
      return { ok: false, error: 'This entry changed since the page loaded. Refresh and try again.' };
    }
    if (current.amount !== cents) {
      await sheet.rewriteAmount(row, cents);
      written = true;
    }
    return { ok: true, amount: cents };
  } catch (error) {
    console.error('correctTransactionAmount failed:', error);
    return { ok: false, error: "Couldn't save the amount. Try again." };
  } finally {
    if (written) {
      try {
        await refreshDashboard();
      } catch (error) {
        console.error('correctTransactionAmount: dashboard revalidation failed:', error);
      }
    }
  }
}
