# Open categories: logic prototype

status: closed (2026-10-14)
assignee: stanley (claude session, 2026-10-14)
labels: wayfinder:prototype

## Question

Can the Category list grow when the LLM finds a gap, without filling up with spelling variants of the same Category? Two approaches are tested together: the list lives in data (#2), and the LLM suggests while the user approves (#3).

## Asset

A logic prototype on branch `prototype/open-categories` (commit eb8b590). It is a single HTML file, `src/app/services/llm/PROTOTYPE-open-categories.html`, with a stubbed LLM, a word-overlap stand-in for similarity, free play, and five walkthroughs:

1. a new kind of expense
2. the same idea in different words
3. look-alikes are only hints
4. the Spending decision
5. things that must not happen

## Resolution (2026-10-14)

The user accepted the approach. Carried into the map:

- The LLM can only answer with a Category on the list. The schema is built from the list, so an answer off the list is rejected.
- A suggestion is checked in this order: a spelling of an existing Category, a known spelling, dismissed, joins a waiting Suggestion, or a new Suggestion. Normalization is the only automatic merge.
- A look-alike score is only a hint. "Clothes → Clothing" and "Pet Insurance → Insurance" score alike, and only the first should merge.
- Every merge, fold and approval records the spelling, so the review queue shrinks over time.
- Approving forces the Spending / Money Movement choice, because it changes the Spending totals.
