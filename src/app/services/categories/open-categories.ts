/**
 * Open Categories: the pure rules behind Category Suggestions (see
 * GLOSSARY.md). No I/O here; ingest, the listing function and the review
 * actions read the sheet and hand rows in.
 *
 * Lifted from the logic prototype (branch prototype/open-categories). Later
 * tickets add the ingest check (respellings, aliases, dismissals), the
 * look-alike hint, and Merge, Fold and Dismiss on top of `normalize` and
 * `groupSuggestions`.
 */

// A word's singular form. The length guards keep short words whole: "gas"
// stays "gas" (not "ga"), "bus" stays "bus", "pies" stays "pies".
function singular(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/**
 * The spelling key two names share when they mean the same Category:
 * lowercased, `&` read as "and", punctuation dropped, each word singular.
 * "Pet Supplies", "pet supply" and "Pet supplies!" all become "pet supply";
 * "Gas & Fuel" becomes "gas and fuel". This is the only automatic merge.
 */
export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(singular)
    .join(' ');
}

/** A sheet row as the suggestion rules need it. */
export interface SuggestionRow {
  row: number;
  motive: string;
  amount: number;
  type: 'Income' | 'Expense';
  category: string;
  suggestedCategory?: string;
}

/** One Expense behind a Category Suggestion, with its current Category. */
export interface SuggestionEntry {
  row: number;
  motive: string;
  amount: number;
  category: string;
  /** The row's own spelling of the suggestion (its column F). */
  suggestedCategory: string;
}

/**
 * A Category Suggestion: the Expense rows whose Suggested Category
 * normalizes to the same `key`. Plain data, so it can go to the client.
 */
export interface CategorySuggestion {
  key: string;
  /** The first-seen spelling (the earliest row's F). */
  label: string;
  entries: SuggestionEntry[];
  total: number;
}

/**
 * The waiting Category Suggestions in `rows`: every Expense row with a
 * non-blank Suggested Category, grouped by its normalized spelling. Groups
 * and their entries keep sheet order, so the first-seen spelling labels each
 * group and the oldest Suggestion comes first.
 */
export function groupSuggestions(rows: readonly SuggestionRow[]): CategorySuggestion[] {
  const groups = new Map<string, CategorySuggestion>();
  for (const t of [...rows].sort((a, b) => a.row - b.row)) {
    const suggested = t.suggestedCategory?.trim();
    if (t.type !== 'Expense' || !suggested) continue;
    const key = normalize(suggested);
    if (!key) continue;
    let group = groups.get(key);
    if (!group) {
      group = { key, label: suggested, entries: [], total: 0 };
      groups.set(key, group);
    }
    group.entries.push({
      row: t.row,
      motive: t.motive,
      amount: t.amount,
      category: t.category,
      suggestedCategory: suggested,
    });
    // Sum in cents so a long list of entries doesn't drift.
    group.total = Math.round((group.total + t.amount) * 100) / 100;
  }
  return [...groups.values()];
}
