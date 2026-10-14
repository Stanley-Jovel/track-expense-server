# 0009: Ship and verify on the iPhone

status: open
assignee: —
labels: wayfinder:task
blocked-by: 0005, 0006, 0007, 0008

## What to build

Merge to main, wait for the Vercel deploy (about 8 minutes), and verify against the live sheet and on the user's iPhone.

## Acceptance criteria

- [ ] In production, the `Categories` sheet is seeded with the current 25 Categories and the correct Spending flags, and the dashboard's Spending totals are unchanged from before the deploy.
- [ ] A real Apple Pay purchase of a kind the list doesn't cover (a pet store or a fuel station) shows up as a waiting Suggestion behind the banner.
- [ ] On the user's iPhone, approving it in the deck moves its entries, and the next purchase from that Merchant is filed under the new Category directly.
- [ ] A purchase the list covers (such as Starbucks) gets no suggestion.
- [ ] The map's Decisions so far is updated and its status is set to closed.
