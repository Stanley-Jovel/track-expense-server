# Review Category Suggestions: UI prototype

status: closed (2026-10-14)
assignee: stanley (claude session, 2026-10-14)
labels: wayfinder:prototype

## Question

Where on the dashboard do waiting Category Suggestions show up, and how does the user decide on them?

## Asset

Prototype on branch `prototype/open-categories-ui` (commit 318a0bd). Seven stub entries with suggestions are mixed into the real data, and decisions are kept in memory. Three variants on `/dashboard` via `?variant=`, with a dev-only floating switcher:

- A, a section on the dashboard: a ledger list under the stat strip. Each suggestion opens a bottom sheet with the full decision form.
- B, marked on the entries: there is no section. A chip on each affected entry opens the same sheet, and a link near the top narrows the list to those entries.
- C, a review deck: a banner opens a tall sheet that steps through the suggestions one at a time, with one-tap answers and a skip.

Run: `npm run prototype:suggestions`, then open `/dashboard?variant=C`.

## Resolution (2026-10-14)

**C (review deck) wins.** Carried into the map and tickets 0005–0008:

- The banner shows only when something is waiting.
- The deck shows one suggestion at a time, with its entries and total and the name as the headline (tap to rename).
- The answers are "No, it's X" (from the hint), "Yes, add it as Spending", "Yes, as Money Movement", "Not a category" and "Skip for now".
- Approving always moves the entries. The deck has no toggle for this.
- Added beyond the prototype: "It's another category…", a picker for merging into any Category, so a suggestion without a hint can still be merged.
