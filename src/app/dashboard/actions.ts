'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { SpreadsheetServiceFactory, readCategoriesOrBuiltIn } from '@/app/services/spreadsheet';
import { merchantName, sameMerchant } from '@/app/services/analytics/merchant';
import {
  ExpenseCategory,
  categoryNames,
  isExpenseCategory,
} from '@/app/services/llm/types';

/**
 * Busts both cache layers behind the dashboard — the tagged unstable_cache
 * holding the sheet rows and the ISR copy of /dashboard — so the next render
 * re-reads the spreadsheet.
 */
export async function refreshDashboard(): Promise<void> {
  revalidateTag('sheet-transactions');
  revalidatePath('/dashboard');
}

// Server actions are an edge: they validate against the Categories sheet's
// list, or the built-in list if that sheet can't be read.
async function loadCategoryNames(): Promise<string[]> {
  return categoryNames(await readCategoriesOrBuiltIn(SpreadsheetServiceFactory.create()));
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
  if (!isExpenseCategory(category, await loadCategoryNames())) {
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

export type TransactionEdit = {
  motive: string;
  category: string;
  amount: number;
  /** The new calendar day, YYYY-MM-DD; the entry keeps its time of day. */
  day: string;
  /**
   * Save the Category as a Category Override for the (edited) Merchant,
   * repairing its other rows too. Only meaningful for an Expense.
   */
  allFromMerchant: boolean;
};

export type ModificationResult = { ok: true } | { ok: false; error: string };

/**
 * Modify one logged Transaction: rewrite its date, Motive, amount and
 * Category (never its Type). `motive` and `amount` are what the dashboard
 * showed for the row: if the sheet no longer matches them (the page is
 * stale), nothing is written. With `allFromMerchant` on an Expense, the
 * Category also becomes the Merchant's Category Override (see
 * correctMerchantCategory), keyed by the Merchant of the edited Motive.
 */
export async function modifyTransaction(
  row: number,
  motive: string,
  amount: number,
  edit: TransactionEdit
): Promise<ModificationResult> {
  // A server action is a public endpoint: validate everything at runtime.
  if (!Number.isInteger(row) || row < 2) {
    return { ok: false, error: 'Unknown entry.' };
  }
  const nextMotive = typeof edit?.motive === 'string' ? edit.motive.trim() : '';
  if (nextMotive === '') {
    return { ok: false, error: 'Enter a name.' };
  }
  if (typeof edit.amount !== 'number' || !Number.isFinite(edit.amount) || edit.amount <= 0) {
    return { ok: false, error: 'Enter an amount greater than $0.' };
  }
  const cents = Math.round(edit.amount * 100) / 100;
  if (typeof edit.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(edit.day)) {
    return { ok: false, error: 'Enter a valid date.' };
  }

  let written = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    const current = (await sheet.readTransactions()).find((t) => t.row === row);
    if (!current || current.motive !== motive || current.amount !== amount) {
      return { ok: false, error: 'This entry changed since the page loaded. Refresh and try again.' };
    }
    // A Category outside the closed list is only allowed if it's the one the
    // row already holds (rows written before the current list existed).
    const categories = await loadCategoryNames();
    if (!isExpenseCategory(edit.category, categories) && edit.category !== current.category) {
      return { ok: false, error: `"${edit.category}" is not a known Category` };
    }
    const date = new Date(`${edit.day}${current.date.toISOString().slice(10)}`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== edit.day) {
      return { ok: false, error: 'Enter a valid date.' };
    }

    await sheet.rewriteTransaction(row, {
      date,
      motive: nextMotive,
      amount: cents,
      category: edit.category,
    });
    written = true;

    if (edit.allFromMerchant === true && current.type === 'Expense' && isExpenseCategory(edit.category, categories)) {
      const merchant = merchantName(nextMotive);
      const result = await correctMerchantCategory(merchant, edit.category);
      if (!result.ok) {
        return {
          ok: false,
          error: `Saved this entry, but couldn't apply ${edit.category} to all ${merchant} expenses. Try again.`,
        };
      }
    }
    return { ok: true };
  } catch (error) {
    console.error('modifyTransaction failed:', error);
    return {
      ok: false,
      error: written
        ? 'Saved this entry, but something else went wrong. Refresh to check.'
        : "Couldn't save the entry. Try again.",
    };
  } finally {
    if (written) {
      try {
        await refreshDashboard();
      } catch (error) {
        console.error('modifyTransaction: dashboard revalidation failed:', error);
      }
    }
  }
}

export type DeletionResult = { ok: true } | { ok: false; error: string };

/**
 * Delete one logged Transaction: its whole sheet row is removed. `motive`
 * and `amount` are what the dashboard showed for the row; deleting shifts
 * later rows up, so if the sheet no longer matches them (the page is stale)
 * nothing is deleted.
 */
export async function deleteTransaction(
  row: number,
  motive: string,
  amount: number
): Promise<DeletionResult> {
  // A server action is a public endpoint: validate everything at runtime.
  if (!Number.isInteger(row) || row < 2) {
    return { ok: false, error: 'Unknown entry.' };
  }

  let deleted = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    const current = (await sheet.readTransactions()).find((t) => t.row === row);
    if (!current || current.motive !== motive || current.amount !== amount) {
      return { ok: false, error: 'This entry changed since the page loaded. Refresh and try again.' };
    }
    await sheet.deleteTransactionRow(row);
    deleted = true;
    return { ok: true };
  } catch (error) {
    console.error('deleteTransaction failed:', error);
    return { ok: false, error: "Couldn't delete the entry. Try again." };
  } finally {
    if (deleted) {
      try {
        await refreshDashboard();
      } catch (error) {
        console.error('deleteTransaction: dashboard revalidation failed:', error);
      }
    }
  }
}
