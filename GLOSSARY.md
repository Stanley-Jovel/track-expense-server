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

The canonical display name for who a Transaction was with, derived from the Motive by stripping card-feed noise (payment-processor prefixes, store numbers, location suffixes) and merging known spelling variants. Purely a presentation concept: the Motive itself is never altered.

## Daily Average

Spending divided by the calendar days elapsed in the selected period (for the current period, days elapsed so far; for a past period, its full length). Calendar days, not days-with-transactions.

## Projected Spend

The Daily Average extrapolated across the full current period: what the period's Spending will total if the pace so far holds. Only the current, incomplete period has a projection; a past period's "projection" is just its actual Spending.

## Spending

The subset of Expense transactions that represent real consumption: all Expenses **excluding** the `Transfers` and `Investments & Savings` categories. `Bank & FX Fees` counts as Spending. Dashboard totals, trends, and category breakdowns use Spending, not raw Expense, so moving money to savings never inflates them.

## Money Movement

Transactions in `Transfers` or `Investments & Savings`: money changing location, not being consumed. Shown separately on the dashboard, excluded from Spending.
