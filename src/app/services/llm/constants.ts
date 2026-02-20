export const EXPENSE_CATEGORIES = [
  'Groceries', 'Dining', 'Transportation', 'Housing', 'Utilities',
  'Healthcare', 'Entertainment', 'Shopping', 'Travel', 'Education',
  'Income', 'Other'
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];
