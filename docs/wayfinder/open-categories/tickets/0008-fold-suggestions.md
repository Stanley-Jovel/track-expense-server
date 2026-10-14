# 0008: Folding two waiting suggestions together

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0006

## What to build

Two Suggestions that mean the same thing, such as "Car Fuel" and "Gas & Fuel", get one decision:

- **The hint** also compares a Suggestion against the other waiting Suggestions. When a Category and a Suggestion tie, the Category wins.
- **"No, it's X"** on a Suggestion look-alike folds this Suggestion into the other one. Its rows' F is rewritten to the target's label, and its spellings are recorded as an `Alias` whose Target is that waiting Suggestion.
- **Later suggestions** with a folded spelling join that Suggestion at ingest: F gets the target's label.
- **Approving the combined Suggestion under a new name** rewrites every spelling that pointed at its old label, so they all end up pointing at the new Category.

Demo: Shell gets "Gas & Fuel" and Chevron gets "Car Fuel". The deck offers "No, it's Gas & Fuel" for Car Fuel. Fold it, then approve Gas & Fuel, and both entries move. The next "Car Fuel" suggestion is filed under Gas & Fuel silently.

## Acceptance criteria

- [ ] The listing function's hint includes the other waiting Suggestions, with a Category winning a tie.
- [ ] The Fold server action rewrites F on the folded rows to the target's label, records the aliases, skips changed rows, and busts the caches.
- [ ] At ingest, an `Alias` whose Target is a waiting Suggestion writes that label to F.
- [ ] Approve rewrites the spellings that pointed at the Suggestion's old label to the approved name.
- [ ] Tests:
  - At the ingest seam: an alias to a Suggestion writes its label to F.
  - At the review seam: a Suggestion look-alike hint, a Category winning a tie, Fold regrouping rows, and Fold followed by Approve under a new name leaving every spelling pointing at the new Category.
- [ ] Lint, type-check and the full test suite pass.
