# 0007: Dismissing a suggestion

status: closed (2026-10-14)
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0006

## What to build

The deck gets a "Not a category" answer. Dismissing records every spelling in the Suggestion as `Dismissed` in `CategorySpellings` and clears F, leaving each entry's Category as it is. From then on, ingest drops a suggestion with a dismissed spelling silently, and F stays blank.

Demo: Venmo gets the suggestion "Misc Stuff". Tap "Not a category", and the card is gone. The next Venmo payment logs with no suggestion.

## Acceptance criteria

- [x] The Dismiss server action records the spellings as `Dismissed`, clears F, leaves the Category alone, skips changed rows, and busts the caches.
- [x] The ingest check order becomes: a respelling, then `Alias`, then `Dismissed` (drop), otherwise write F.
- [x] The deck shows "Not a category".
- [x] Tests:
  - At the ingest seam: a dismissed spelling is dropped, with F blank.
  - At the review seam: Dismiss clears F and keeps the Category.
- [x] Lint, type-check and the full test suite pass.
