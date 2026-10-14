/**
 * Open Categories: the pure rules behind Category Suggestions (see
 * GLOSSARY.md). No I/O here; ingest, the listing function and the review
 * actions read the sheet and hand rows in.
 *
 * Lifted from the logic prototype (branch prototype/open-categories):
 * `spellingKey`, grouping rows into Suggestions, the ingest check against the
 * Category list and the recorded Category Spellings, and the look-alike hint.
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
export function spellingKey(name: string): string {
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
 * has the same spelling key, `key`. Plain data, so it can go to the client.
 */
export interface CategorySuggestion {
  key: string;
  /** The first-seen spelling (the earliest row's F). */
  label: string;
  entries: SuggestionEntry[];
  total: number;
  /** What it looks like, if anything (see withHints). Only ever offered. */
  hint?: SuggestionHint;
}

/**
 * The answer "No, it's X": a Category the Suggestion looks like (Merge), or
 * another waiting Suggestion (Fold).
 */
export type SuggestionHint =
  | { kind: 'category'; name: string }
  | { kind: 'suggestion'; key: string; label: string };

/**
 * The waiting Category Suggestions in `rows`: every Expense row with a
 * non-blank Suggested Category, grouped by its spelling key. Groups
 * and their entries keep sheet order, so the first-seen spelling labels each
 * group and the oldest Suggestion comes first.
 */
export function groupSuggestions(rows: readonly SuggestionRow[]): CategorySuggestion[] {
  const groups = new Map<string, CategorySuggestion>();
  for (const t of [...rows].sort((a, b) => a.row - b.row)) {
    const suggested = t.suggestedCategory?.trim();
    if (t.type !== 'Expense' || !suggested) continue;
    const key = spellingKey(suggested);
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

/** What a recorded spelling resolves to (see GLOSSARY.md: Category Spelling). */
export type SpellingOutcome = 'Alias' | 'Dismissed';

/**
 * One row of the CategorySpellings sheet: a spelling key the user has
 * already answered, and what it means from now on. An `Alias` targets a
 * Category (after Approve or Merge) or a waiting Suggestion's label (after a
 * fold); a `Dismissed` spelling has no target.
 */
export interface CategorySpelling {
  spelling: string;
  outcome: SpellingOutcome;
  target: string;
  /** ISO timestamp of the last time it was recorded. */
  updatedAt: string;
}

/** What ingest does with a suggestion (see checkSuggestion). */
export type SuggestionCheck =
  | { kind: 'file'; category: string } // under this Category, F blank
  | { kind: 'suggest'; label: string } // waits for review: this goes in F
  | { kind: 'drop' }; // a dismissed spelling: F blank, the LLM's Category stays

/**
 * The ingest check for an Expense's suggestion, from the logic prototype:
 * first match wins. A respelling of a Category is filed there; a recorded
 * spelling follows its outcome (an Alias to a Category is filed there, an
 * Alias to a waiting Suggestion joins it, a Dismissed spelling is dropped);
 * anything else waits for review in F.
 */
export function checkSuggestion(
  suggestion: string,
  categories: readonly string[],
  spellings: readonly CategorySpelling[]
): SuggestionCheck {
  const key = spellingKey(suggestion);
  const same = categories.find((c) => spellingKey(c) === key);
  if (same) return { kind: 'file', category: same };
  const recorded = spellings.find((s) => s.spelling === key);
  if (recorded?.outcome === 'Alias') {
    // The target may be a Category spelled differently than on the list, or
    // the label of a waiting Suggestion (a fold).
    const category = categories.find((c) => spellingKey(c) === spellingKey(recorded.target));
    return category
      ? { kind: 'file', category }
      : { kind: 'suggest', label: recorded.target };
  }
  if (recorded?.outcome === 'Dismissed') return { kind: 'drop' };
  return { kind: 'suggest', label: suggestion };
}

/**
 * `t` with its Suggested Category (column F) set to `suggested`, trimmed, or
 * with none when `suggested` is missing or blank: a blank F reads back as no
 * suggestion.
 */
export function withSuggestedCategory<T extends { suggestedCategory?: string }>(
  t: T,
  suggested?: string
): T {
  const rest = { ...t };
  delete rest.suggestedCategory;
  const trimmed = suggested?.trim();
  return trimmed ? { ...rest, suggestedCategory: trimmed } : rest;
}

// Words too common to make two names look alike.
const STOP_WORDS = new Set(['and', 'the', 'of', 'for']);

function wordsOf(name: string): string[] {
  return [...new Set(spellingKey(name).split(' ').filter((w) => w && !STOP_WORDS.has(w)))];
}

// Two words count as the same when they share a start of at least 5 letters
// that covers the shorter word, but for perhaps its last letter: "clothe"
// (from Clothes) matches "clothing", while "car" never matches "card" and
// "transfer" never matches "transportation". Word stems only; no synonym
// folding.
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  let common = 0;
  while (common < a.length && a[common] === b[common]) common++;
  return common >= 5 && common >= Math.min(a.length, b.length) - 1;
}

/**
 * The share of words two names have in common: shared words over the word
 * count of the longer name. "Car Fuel" and "Gas & Fuel" share 1 of 2 (50%);
 * "Pet Insurance" and "Insurance" share 1 of 2 too.
 */
function lookAlike(a: string, b: string): number {
  const A = wordsOf(a);
  const B = wordsOf(b);
  const shared = A.filter((w) => B.some((x) => sameWord(w, x))).length;
  const longer = Math.max(A.length, B.length);
  return longer === 0 ? 0 : shared / longer;
}

/** A hint is shown at 50% of words in common or more. */
const HINT_THRESHOLD = 0.5;

/**
 * Each Suggestion with its look-alike hint, if it has one: the Category or
 * other waiting Suggestion with the highest share of words in common, at 50%
 * or more; on a tie the earlier candidate wins, so a Category beats a
 * Suggestion. Only ever offered, never applied: "Pet Insurance" looks
 * just as much like Insurance as "Clothes" looks like Clothing.
 */
export function withHints(
  suggestions: readonly CategorySuggestion[],
  categories: readonly string[]
): CategorySuggestion[] {
  return suggestions.map((suggestion) => {
    let best: { hint: SuggestionHint; score: number } | undefined;
    const consider = (hint: SuggestionHint, name: string) => {
      const score = lookAlike(suggestion.label, name);
      if (score >= HINT_THRESHOLD && (!best || score > best.score)) best = { hint, score };
    };
    // Categories go first, so a Category wins a tie with anything after.
    for (const name of categories) consider({ kind: 'category', name }, name);
    for (const other of suggestions) {
      if (other.key === suggestion.key) continue;
      consider({ kind: 'suggestion', key: other.key, label: other.label }, other.label);
    }
    return best ? { ...suggestion, hint: best.hint } : suggestion;
  });
}
