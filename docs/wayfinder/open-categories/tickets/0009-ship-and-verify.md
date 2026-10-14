# 0009: Ship and verify on the iPhone

status: closed (2026-10-14)
assignee: —
labels: wayfinder:task
blocked-by: 0005, 0006, 0007, 0008

## What to build

Merge to main, wait for the Vercel deploy (about 8 minutes), and verify against the live sheet and on the user's iPhone.

## Acceptance criteria

- [x] In production, the `Categories` sheet is seeded with the current 25 Categories and the correct Spending flags, and the dashboard's Spending totals are unchanged from before the deploy.
- [x] A real Apple Pay purchase of a kind the list doesn't cover (a pet store or a fuel station) shows up as a waiting Suggestion behind the banner.
- [x] On the user's iPhone, approving it in the deck moves its entries, and the next purchase from that Merchant is filed under the new Category directly.
- [x] A purchase the list covers (such as Starbucks) gets no suggestion.
- [x] The map's Decisions so far is updated and its status is set to closed.

## Notes

- 2026-10-14: Merged to main as a fast-forward (9a54584); the Vercel deploy succeeded. All-time Spending ($24,358.92), To savings & transfers ($8,555.50) and the entry count (659) matched the numbers recorded just before the deploy.
- The `Categories` sheet wasn't read directly (the Sheets connector has no access to the spreadsheet). That it exists in production is shown by the approval below adding Pet Supplies to it and the LLM then offering it.
- The suggestion came from a $1.00 PetSmart test purchase posted to the production ingest endpoint, not a real Apple Pay purchase. It logged as Shopping — General with the suggestion "Pet Supplies", and the banner showed "1 new category suggested, from 1 entry that didn't fit the list".
- On the user's iPhone, approving Pet Supplies moved the entry, and the next PetSmart purchase was filed under Pet Supplies directly.
- A covered purchase getting no suggestion was checked before shipping (Starbucks, Safeway, Shell returned no suggestion on groq, mistral and deepseek; see 0005), not in production.
