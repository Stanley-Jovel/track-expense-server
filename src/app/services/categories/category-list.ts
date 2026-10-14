/**
 * The Category list (see GLOSSARY.md: Category): the built-in Categories
 * that seed the Categories sheet, and the CategoryList value the edges
 * (ingest, the dashboard page, server actions) build from that sheet and
 * hand down. No I/O here.
 */

/** The built-in Categories, in the order they seed the Categories sheet. */
export const BUILT_IN_CATEGORY_NAMES = [
  // Housing & Utilities
  'Rent / Mortgage',
  'Utilities',
  'Internet & Phone',
  'Home Maintenance & Furnishings',
  // Food
  'Groceries',
  'Dining Out',
  'Coffee & Quick Bites',
  // Getting Around
  'Local Transportation',
  'Travel',
  // Health
  'Medical & Pharmacy',
  'Fitness & Wellness',
  'Personal Care',
  // Lifestyle
  'Shopping — General',
  'Clothing',
  'Entertainment',
  'Subscriptions',
  // Obligations
  'Insurance',
  'Taxes',
  'Education',
  // People & Causes
  'Gifts',
  'Donations / Charity',
  // Money Movement (excluded from dashboard Spending — see GLOSSARY.md)
  'Investments & Savings',
  'Transfers',
  // Fees are consumed money, so despite the banking flavor this is Spending.
  'Bank & FX Fees',
  // Income
  'Income',
] as const;

/**
 * A Category is any name on the Category list. The list lives in the
 * Categories sheet, so this is a plain string checked against a list at the
 * edges (see CategoryList.has), not a closed union.
 */
export type Category = string;

/** Whether `name` is one of the given Category `names`. */
export function isCategory(name: unknown, names: readonly string[]): name is Category {
  return names.some((c) => c === name);
}

/**
 * One row of the Category list: its name and whether its Expenses count as
 * Spending. A Category that doesn't is Money Movement.
 */
export interface CategoryEntry {
  name: Category;
  countsAsSpending: boolean;
}

// Income never counts as Spending (it isn't an Expense); the flag only keeps
// the list honest when read by hand in the Categories sheet.
const BUILT_IN_NOT_SPENDING_NAMES: readonly string[] = ['Transfers', 'Investments & Savings', 'Income'];

/**
 * The built-in list with its Spending flags. It seeds the Categories sheet on
 * first read and is the fallback whenever that sheet can't be read.
 */
export const BUILT_IN_CATEGORIES: readonly CategoryEntry[] = BUILT_IN_CATEGORY_NAMES.map((name) => ({
  name,
  countsAsSpending: !BUILT_IN_NOT_SPENDING_NAMES.includes(name),
}));

/**
 * A Category list as the rest of the app uses it: the names in order, the
 * ones that don't count as Spending, and a membership check. Holds a
 * function, so it is built where it is used; plain CategoryEntry rows are
 * what crosses a cache or the server/client boundary.
 */
export interface CategoryList {
  readonly names: readonly Category[];
  readonly notSpending: readonly Category[];
  has(name: unknown): name is Category;
}

export function categoryList(entries: readonly CategoryEntry[]): CategoryList {
  const names = entries.map((c) => c.name);
  return {
    names,
    notSpending: entries.filter((c) => !c.countsAsSpending).map((c) => c.name),
    has: (name: unknown): name is Category => isCategory(name, names),
  };
}

export const BUILT_IN_CATEGORY_LIST: CategoryList = categoryList(BUILT_IN_CATEGORIES);
