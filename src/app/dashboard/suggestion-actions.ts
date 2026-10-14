'use server';

import { SpreadsheetServiceFactory } from '@/app/services/spreadsheet';
import type {
  SheetTransaction,
  SpreadsheetService,
  SuggestionRewrite,
} from '@/app/services/spreadsheet/types';
import {
  CategorySpelling,
  SpellingOutcome,
  groupSuggestions,
  normalize,
} from '@/app/services/categories/open-categories';
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
 * The second half of every answer: record the Suggestion's spellings in the
 * CategorySpellings sheet, then rewrite each of its rows that is unchanged
 * since it was listed. Spellings go first: if the rows can't be written, the
 * same answer can simply be given again (recording is an upsert), and later
 * Expenses already follow it.
 *
 * Every row of a Suggestion normalizes to its key, so the key is its only
 * recorded spelling of its own. Spellings folded into it earlier (Aliases
 * whose Target is its label) follow the same answer: approved under a new
 * name, merged, dismissed or folded again, they end up where it does instead
 * of pointing at a label that is no longer waiting.
 */
async function recordAndRewrite(
  sheet: SpreadsheetService,
  answer: ListedSuggestion,
  spelling: { outcome: SpellingOutcome; target: string },
  rewrite: (row: SheetTransaction) => SuggestionRewrite
): Promise<{ moved: number; skipped: number }> {
  const rows = await sheet.readTransactions();
  const unchanged = unchangedRows(rows, answer);
  const updatedAt = new Date().toISOString();
  const folded = (await sheet.readCategorySpellings()).filter(
    (s) => s.outcome === 'Alias' && s.spelling !== answer.key && normalize(s.target) === answer.key
  );
  const recorded: CategorySpelling[] = [answer.key, ...folded.map((s) => s.spelling)].map(
    (key) => ({ spelling: key, ...spelling, updatedAt })
  );
  await sheet.recordCategorySpellings(recorded);
  await sheet.rewriteSuggestions(unchanged.map(rewrite));
  return { moved: unchanged.length, skipped: answer.entries.length - unchanged.length };
}

// Like ingest, a revalidation problem is logged and never turns a saved
// answer into a failure.
async function refreshAfter(action: string): Promise<void> {
  try {
    await refreshDashboard();
  } catch (error) {
    console.error(`${action}: dashboard revalidation failed:`, error);
  }
}

/**
 * Merge a Category Suggestion into a Category already on the list ("No,
 * it's X" or "It's another category…"): record its spelling as an Alias of
 * that Category, so later Expenses with it are filed there directly, move
 * its entries into the Category and clear their F.
 */
export async function mergeSuggestion(
  answer: ListedSuggestion & { into: string }
): Promise<ReviewResult> {
  if (!isListedSuggestion(answer) || typeof answer.into !== 'string') {
    return { ok: false, error: 'Unknown suggestion.' };
  }
  let wrote = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    const categories = await sheet.readCategories();
    const into = categories.find((c) => c.name === answer.into)?.name;
    if (!into) {
      return { ok: false, error: `${answer.into} is not a category.` };
    }
    wrote = true;
    const { moved, skipped } = await recordAndRewrite(
      sheet,
      answer,
      { outcome: 'Alias', target: into },
      (t) => ({ row: t.row, category: into, suggestedCategory: '' })
    );
    return { ok: true, moved, skipped };
  } catch (error) {
    console.error('mergeSuggestion failed:', error);
    return { ok: false, error: `Couldn't move these into ${answer.into}. Try again.` };
  } finally {
    if (wrote) await refreshAfter('mergeSuggestion');
  }
}

/**
 * Dismiss a Category Suggestion ("Not a category"): record its spelling as
 * Dismissed, so ingest drops it silently from then on, and clear its
 * entries' F. Each entry keeps the Category the LLM gave it.
 */
export async function dismissSuggestion(answer: ListedSuggestion): Promise<ReviewResult> {
  if (!isListedSuggestion(answer)) {
    return { ok: false, error: 'Unknown suggestion.' };
  }
  try {
    const sheet = SpreadsheetServiceFactory.create();
    const { moved, skipped } = await recordAndRewrite(
      sheet,
      answer,
      { outcome: 'Dismissed', target: '' },
      (t) => ({ row: t.row, suggestedCategory: '' })
    );
    return { ok: true, moved, skipped };
  } catch (error) {
    console.error('dismissSuggestion failed:', error);
    return { ok: false, error: "Couldn't dismiss this suggestion. Try again." };
  } finally {
    await refreshAfter('dismissSuggestion');
  }
}

/**
 * Approve a Category Suggestion as a new Category: add `name` to the
 * Categories sheet with its Spending flag (so the LLM is offered it from the
 * next Expense on), record the Suggestion's spelling as its Alias, move the
 * Suggestion's entries into it and clear their F.
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

    // The Category goes in first: an Alias must never point at a Category
    // that isn't on the list. If the entries then can't be moved, a retry
    // would be refused as a duplicate, so the error sends the user to Merge
    // ("It's another category…"), which finishes the job.
    await sheet.addCategory({ name, countsAsSpending: answer.countsAsSpending });
    added = true;

    const { moved, skipped } = await recordAndRewrite(
      sheet,
      answer,
      { outcome: 'Alias', target: name },
      (t) => ({ row: t.row, category: name, suggestedCategory: '' })
    );
    return { ok: true, moved, skipped };
  } catch (error) {
    console.error('approveSuggestion failed:', error);
    return {
      ok: false,
      error: added
        ? `Added ${name}, but its entries couldn't be moved. Use "It's another category…" to move them into ${name}.`
        : `Couldn't add ${name}. Try again.`,
    };
  } finally {
    if (added) await refreshAfter('approveSuggestion');
  }
}

/**
 * Fold a Category Suggestion into another waiting Suggestion ("No, it's X"
 * on a Suggestion look-alike): record its spelling as an Alias of the
 * target's label, so later Expenses with it join the target at ingest, and
 * rewrite its rows' F to that label so they are listed with the target.
 * Their Category stays as it is until the target is answered.
 */
export async function foldSuggestion(
  answer: ListedSuggestion & { into: string }
): Promise<ReviewResult> {
  if (!isListedSuggestion(answer) || typeof answer.into !== 'string') {
    return { ok: false, error: 'Unknown suggestion.' };
  }
  let wrote = false;
  try {
    const sheet = SpreadsheetServiceFactory.create();
    // The target must still be waiting, under the label it was listed with.
    const target = groupSuggestions(await sheet.readTransactions()).find(
      (s) => s.label === answer.into && s.key !== answer.key
    );
    if (!target) {
      return { ok: false, error: `${answer.into} is no longer waiting for review.` };
    }
    wrote = true;
    const { moved, skipped } = await recordAndRewrite(
      sheet,
      answer,
      { outcome: 'Alias', target: target.label },
      (t) => ({ row: t.row, suggestedCategory: target.label })
    );
    return { ok: true, moved, skipped };
  } catch (error) {
    console.error('foldSuggestion failed:', error);
    return { ok: false, error: `Couldn't fold these into ${answer.into}. Try again.` };
  } finally {
    if (wrote) await refreshAfter('foldSuggestion');
  }
}
