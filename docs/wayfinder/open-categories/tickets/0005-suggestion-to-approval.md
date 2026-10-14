# 0005: First full path: a suggestion goes from ingest to approval

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0004

## What to build

The narrowest complete path through the feature:

1. When nothing on the list fits an Expense, the LLM suggests a Category.
2. The suggestion is saved on the row in a new column F, "Suggested Category".
3. Rows whose suggestions normalize to the same spelling form one Category Suggestion.
4. The dashboard shows a banner, "N new categories suggested, from M entries that didn't fit the list · Review ›".
5. The banner opens the review deck, which shows one Suggestion at a time: its name (tap to rename), its entry count, its total, and its entries with their current Category. In this ticket the deck offers only three answers:
   - "Yes, add it as Spending"
   - "Yes, as Money Movement"
   - "Skip for now"
6. Approving adds the Category with that Spending flag, moves the Suggestion's entries into it, clears F, and offers the new Category to the LLM from then on.

The deck's other answers come in 0006–0008. See the map's Implementation Decisions for normalization, the ingest order and the deck's layout. The visual reference is variant C on branch `prototype/open-categories-ui`.

Demo: log PetSmart, with the suggestion "Pet Supplies", and Chewy, with "pet supply". The deck shows one "Pet Supplies" card with 2 entries. Approve it as Spending. Both rows become Pet Supplies, and the next PetSmart purchase is filed under Pet Supplies directly, with no suggestion.

## Acceptance criteria

- [ ] The schema has an optional (or nullable) `suggested_category`. The prompt asks for one only when nothing on the list is a clear fit, only for Expenses, and as a short, general kind of expense (never a Merchant).
- [ ] groq, deepseek and mistral each return a valid answer with and without a suggestion, checked by hand on a few real card-feed Motives.
- [ ] Ingest applies Category Overrides first, and an override clears that Expense's suggestion. Income never gets F. Otherwise the suggestion is written to F.
- [ ] Transaction reads include F. The spreadsheet service, both real and mock, can write F.
- [ ] A server function lists waiting Suggestions, grouped by normalized F, each with its label (the first-seen spelling), its entries with their current Category, and its total.
- [ ] The Approve server action:
  - refuses a name that normalizes to an existing Category
  - otherwise adds the Category with its Spending flag, rewrites the Category of the Suggestion's rows, clears F, and busts the caches
  - skips rows that changed since they were listed, re-checking each row before writing to it, as Modify does
- [ ] The banner is hidden when nothing is waiting.
- [ ] The deck shows the next Suggestion after each answer and says "All caught up" when it's empty.
- [ ] A failed answer shows inline and keeps the Suggestion on screen.
- [ ] The deck works at 375px.
- [ ] Tests:
  - At the ingest seam: spelling variants land in one Suggestion, an override clears the suggestion, Income gets no F, and an Expense that fits gets no F.
  - At the review seam (the listing function and Approve, against the mock service): grouping and totals, approval moving rows and clearing F, a duplicate name refused, and changed rows skipped.
- [ ] GLOSSARY.md defines Category Suggestion.
- [ ] Lint, type-check and the full test suite pass.
