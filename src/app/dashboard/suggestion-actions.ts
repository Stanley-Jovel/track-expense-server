'use server';

import { SpreadsheetServiceFactory } from '@/app/services/spreadsheet';
import type { SheetTransaction, SuggestionRewrite } from '@/app/services/spreadsheet/types';
import { normalize } from '@/app/services/categories/open-categories';
import { refreshDashboard } from './actions';

// The review deck's answers (see GLOSSARY.md: Category Suggestion). Each one
// acts on the entries the deck showed, re-checking every row before writing
// to it, as Modify and Delete do: a row that changed since it was listed is
// skipped, never overwritten.

/** An entry as the deck listed it: enough to recognize its row again. */
export interface ListedEntry {
  row: number;
  motive: string;
  amount: number;
}

/** A Suggestion as the deck listed it. */
export interface ListedSuggestion {
  key: string;
  entries: ListedEntry[];
}

export type ReviewResult =
  | { ok: true; moved: number; skipped: number }
  | { ok: false; error: string };

// A server action is a public endpoint: check the listed Suggestion's shape
// at runtime before trusting any of it.
function isListedSuggestion(s: unknown): s is ListedSuggestion {
  if (typeof s !== 'object' || s === null) return false;
  const { key, entries } = s as Partial<ListedSuggestion>;
  return (
    typeof key === 'string' &&
    key !== '' &&
    Array.isArray(entries) &&
    entries.every(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        Number.isInteger(e.row) &&
        e.row >= 2 &&
        typeof e.motive === 'string' &&
        typeof e.amount === 'number'
    )
  );
}

// The listed entries whose rows still hold what the deck showed: the same
// Motive and amount, still an Expense, and still suggesting this Suggestion.
function unchangedRows(
  rows: SheetTransaction[],
  suggestion: ListedSuggestion
): SheetTransaction[] {
  return suggestion.entries.flatMap((entry) => {
    const current = rows.find((t) => t.row === entry.row);
    const unchanged =
      current &&
      current.type === 'Expense' &&
      current.motive === entry.motive &&
      current.amount === entry.amount &&
      normalize(current.suggestedCategory ?? '') === suggestion.key;
    return unchanged ? [current] : [];
  });
}

/**
 * Approve a Category Suggestion as a new Category: add `name` to the
 * Categories sheet with its Spending flag (so the LLM is offered it from the
 * next Expense on), move the Suggestion's entries into it and clear their F.
 * Refused when `name` is just a spelling of a Category already on the list.
 * Approving always moves the entries.
 */
export async function approveSuggestion(
  answer: ListedSuggestion & { name: string; countsAsSpending: boolean }
): Promise<ReviewResult> {
  if (!isListedSuggestion(answer) || typeof answer.countsAsSpending !== 'boolean') {
    return { ok: false, error: 'Unknown suggestion.' };
  }
  const name = typeof answer.name === 'string' ? answer.name.trim().replace(/\s+/g, ' ') : '';
  if (normalize(name) === '') {
    return { ok: false, error: 'Enter a name for the category.' };
  }
  if (name.length > 60) {
    return { ok: false, error: 'Use a shorter name (60 characters at most).' };
  }

  let added = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    // Read the list itself, not the built-in fallback: adding to a list that
    // can't be read could duplicate a Category.
    const categories = await sheet.readCategories();
    const existing = categories.find((c) => normalize(c.name) === normalize(name));
    if (existing) {
      return {
        ok: false,
        error:
          existing.name === name
            ? `${name} is already a category.`
            : `"${name}" is already a category: ${existing.name}.`,
      };
    }

    const rows = await sheet.readTransactions();
    const unchanged = unchangedRows(rows, answer);

    await sheet.addCategory({ name, countsAsSpending: answer.countsAsSpending });
    added = true;

    const rewrites: SuggestionRewrite[] = unchanged.map((t) => ({
      row: t.row,
      category: name,
      suggestedCategory: '',
    }));
    await sheet.rewriteSuggestions(rewrites);

    return {
      ok: true,
      moved: rewrites.length,
      skipped: answer.entries.length - rewrites.length,
    };
  } catch (error) {
    console.error('approveSuggestion failed:', error);
    return {
      ok: false,
      error: added
        ? `Added ${name}, but its entries couldn't be moved. Refresh and check.`
        : `Couldn't add ${name}. Try again.`,
    };
  } finally {
    if (added) {
      // Like ingest, a revalidation problem is logged and never turns a
      // saved answer into a failure.
      try {
        await refreshDashboard();
      } catch (error) {
        console.error('approveSuggestion: dashboard revalidation failed:', error);
      }
    }
  }
}
