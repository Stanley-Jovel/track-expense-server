# Glossary

## Transaction

A single money event logged to the Transactions sheet: a timestamp, a Motive, an amount, a Type, and a Category. Most transactions arrive automatically via Apple Pay automations; Income transactions are entered manually.

## Motive

The free-text description of what a Transaction was for (merchant name, reason). Parsed from natural language input.

## Type

Whether a Transaction is `Income` or `Expense`. Exactly these two values.

## Category

One of the 26 fixed categories a Transaction is classified into. The set is closed; the LLM must pick from it and never invents new ones.

## Spending

The subset of Expense transactions that represent real consumption: all Expenses **excluding** the `Transfers` and `Investments & Savings` categories. `Bank & FX Fees` counts as Spending. Dashboard totals, trends, and category breakdowns use Spending, not raw Expense, so moving money to savings never inflates them.

## Money Movement

Transactions in `Transfers` or `Investments & Savings`: money changing location, not being consumed. Shown separately on the dashboard, excluded from Spending.
