# Glossary

## Transaction

A single money event logged to the Transactions sheet: a timestamp, a Motive, an amount, a Type, and a Category. Most transactions arrive automatically via Apple Pay automations; Income transactions are entered manually.

## Motive

The free-text description of what a Transaction was for (merchant name, reason). Parsed from natural language input.

## Type

Whether a Transaction is `Income` or `Expense`. Exactly these two values.

## Category

One of the 26 fixed categories a Transaction is classified into. The set is closed; the LLM must pick from it and never invents new ones.

## Merchant

The canonical display name for who a Transaction was with, derived from the Motive by stripping card-feed noise (payment-processor prefixes, store numbers, location suffixes) and merging known spelling variants. Still derived at display time (the Motive itself changes only when the user modifies an entry's name), but no longer purely presentational: a Merchant also keys Category Overrides. Merchants are compared case-insensitively for that purpose, so card-feed casing variants (`Las Brumas` / `LAS BRUMAS`) are one Merchant.

## Category Override

A user-chosen Merchant → Category mapping, saved from the dashboard when the user modifies an Expense's Category and leaves "use it for all of this Merchant's expenses" checked (unchecked, only that one entry's Category changes and no override is saved). An override applies to every Transaction from that Merchant, never to just one: saving it rewrites the Category cell of every past row whose Motive clusters to the Merchant, and new Transactions from that Merchant take the override's Category instead of the LLM's. One per Merchant (saving again replaces it), stored in the `CategoryOverrides` sheet (Merchant, Category, Updated-at), where it can be inspected or deleted by hand.

## Daily Average

Spending divided by the calendar days elapsed in the selected period (for the current period, days elapsed so far; for a past period, its full length). Calendar days, not days-with-transactions.

## Projected Spend

The Daily Average extrapolated across the full current period: what the period's Spending will total if the pace so far holds. Only the current, incomplete period has a projection; a past period's "projection" is just its actual Spending.

## Spending

The subset of Expense transactions that represent real consumption: all Expenses **excluding** the `Transfers` and `Investments & Savings` categories. `Bank & FX Fees` counts as Spending. Dashboard totals, trends, and category breakdowns use Spending, not raw Expense, so moving money to savings never inflates them.

## Money Movement

Transactions in `Transfers` or `Investments & Savings`: money changing location, not being consumed. Shown separately on the dashboard, excluded from Spending.
