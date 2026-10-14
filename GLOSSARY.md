# Glossary

## Transaction

A single money event logged to the Transactions sheet: a timestamp, a Motive, an amount, a Type, a Category and, for an Expense that fits no Category well, a Suggested Category (column F; see Category Suggestion). Most transactions arrive automatically via Apple Pay automations; Income transactions are entered manually.

## Motive

The free-text description of what a Transaction was for (merchant name, reason). Parsed from natural language input.

## Type

Whether a Transaction is `Income` or `Expense`. Exactly these two values.

## Category

One of the Categories on the Category list that a Transaction is classified into. The list is closed at parse time: the LLM must pick from it and never invents new ones. It lives in the `Categories` sheet (Category, Counts as Spending, Added-at), which is created and seeded with the 25 built-in Categories on first read, and it grows only by approval (or by a hand edit to that sheet). Each Category says whether it counts as Spending. If the sheet can't be read, the built-in list is used.

## Category Suggestion

The group of Expense rows whose Suggested Category has the same spelling key. When nothing on the Category list is a clear fit for an Expense, the LLM still files it under the closest Category, and also suggests a short, general kind of expense (never a Merchant), which is written to the row's column F, "Suggested Category". Income never gets one, nor does an Expense whose Merchant has a Category Override. The spelling key (`spellingKey` in code) lowercases, reads `&` as "and", drops punctuation and makes each word singular, so "Pet Supplies" and "pet supply" are one Category Suggestion, labelled by its first-seen spelling. A Category Suggestion waits for review on the dashboard; approving it adds it to the Category list (as Spending or Money Movement), moves its rows into it and clears their F. Merging it instead moves its rows into a Category already on the list ("No, it's X" when it has a Look-alike Hint to one, or "It's another category…" for any). It can also be Folded into another waiting Category Suggestion, or Dismissed. A suggestion that is just a respelling of a Category is never a Category Suggestion: ingest files it under that Category, with F blank.

## Category Spelling

The spelling key of a suggestion the user has already answered, one row in the CategorySpellings sheet (Spelling, Outcome, Target, Updated-at). Its Outcome is one of:

- `Alias`: its Target is where the suggestion goes. Approving or Merging a Category Suggestion records an Alias of the Category it went to; Folding records an Alias of the waiting Category Suggestion it joined (its label). An answer to a Category Suggestion re-records the spellings Folded into it with the same Outcome and Target, so no Alias is left pointing at a label that is no longer waiting.
- `Dismissed`: no Target; the suggestion is dropped (see Dismiss).

Ingest checks a suggestion in order, first match wins: a respelling of a Category files it under that Category; an Alias to a Category files it there; an Alias to a waiting Category Suggestion writes that Suggestion's label to F, so it joins it; a Dismissed spelling is dropped (F blank, the LLM's Category stays); otherwise the suggestion waits in F. If the sheet can't be read, ingest skips the Category Spelling checks and still logs the Transaction. Deleting a row by hand undoes the answer.

## Look-alike Hint

The answer "No, it's X" the review deck offers when a Category Suggestion looks like a Category or another waiting Category Suggestion: the one sharing the largest share of words with it, counted against the longer name's words after dropping "and", "the", "of" and "for" (words match on a shared start of 5+ letters, so Clothes matches Clothing), at 50% or more. A Category wins a tie. "Car Fuel" and "Gas & Fuel" share 1 of 2 words; so do "Pet Insurance" and Insurance. Only ever offered, never applied: on a Category it Merges, on a Category Suggestion it Folds.

## Fold

Answering a Category Suggestion with another waiting one ("No, it's X" on a Look-alike Hint to a Category Suggestion): its spelling is recorded as an Alias of the target's label and its rows' F is rewritten to that label, so they are listed and later decided with the target. Their Category stays as it is until the target is answered.

## Dismiss

Answering a Category Suggestion with "Not a category": its spelling is recorded as Dismissed and its rows' F is cleared, each keeping the Category the LLM gave it. Ingest then drops that suggestion silently from then on.

## Merchant

The canonical display name for who a Transaction was with, derived from the Motive by stripping card-feed noise (payment-processor prefixes, store numbers, location suffixes) and merging known spelling variants. Still derived at display time (the Motive itself changes only when the user modifies an entry's name), but no longer purely presentational: a Merchant also keys Category Overrides. Merchants are compared case-insensitively for that purpose, so card-feed casing variants (`Las Brumas` / `LAS BRUMAS`) are one Merchant.

## Category Override

A user-chosen Merchant → Category mapping, saved from the dashboard when the user modifies an Expense's Category and leaves "use it for all of this Merchant's expenses" checked (unchecked, only that one entry's Category changes and no override is saved). An override applies to every Transaction from that Merchant, never to just one: saving it rewrites the Category cell of every past row whose Motive clusters to the Merchant, and new Transactions from that Merchant take the override's Category instead of the LLM's. One per Merchant (saving again replaces it), stored in the `CategoryOverrides` sheet (Merchant, Category, Updated-at), where it can be inspected or deleted by hand.

## Daily Average

Spending divided by the calendar days elapsed in the selected period (for the current period, days elapsed so far; for a past period, its full length). Calendar days, not days-with-transactions.

## Projected Spend

The Daily Average extrapolated across the full current period: what the period's Spending will total if the pace so far holds. Only the current, incomplete period has a projection; a past period's "projection" is just its actual Spending.

## Spending

The subset of Expense transactions that represent real consumption: all Expenses **excluding** those in a Category whose Counts as Spending flag is off in the `Categories` sheet (seeded off for `Transfers`, `Investments & Savings` and `Income`). `Bank & FX Fees` counts as Spending. Dashboard totals, trends, and category breakdowns use Spending, not raw Expense, so moving money to savings never inflates them.

## Money Movement

Expenses in a Category that doesn't count as Spending (seeded as `Transfers` and `Investments & Savings`): money changing location, not being consumed. Shown separately on the dashboard, excluded from Spending.
