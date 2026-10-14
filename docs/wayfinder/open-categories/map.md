# Map: Open Categories

labels: `wayfinder:map`, `ready-for-agent`
tickets: [tickets/](tickets/)
status: open

## Problem Statement

My Expenses are filed into a fixed list of 25 Categories. When something I buy fits none of them (pet food, fuel for the car, a car loan payment), it gets forced into the nearest match, usually Shopping — General or Transfers. My Spending by category then blurs, and nothing tells me the list has a gap: I only find out by reading rows. The obvious fix, letting the LLM invent Categories freely, would make it worse. I'd get "Pet Supplies", "pet supply" and "Pets" as three separate Categories, each splitting my breakdowns, and none of them would know whether it counts as Spending or as money just moving between my accounts.

## Solution

The Category list keeps working as a closed list, but it can now grow, and it grows only when I say so.

When the LLM logs an Expense, it still has to pick a Category from my current list, so every row lands somewhere I recognize. When nothing on the list really fits, it also suggests a new Category. The suggestion is quietly checked against what I've already decided:

- A different spelling of a Category I have is filed under that Category.
- A spelling I've already merged is filed where I merged it.
- A suggestion I dismissed before is dropped.
- Anything else waits for me, grouped with other Expenses that got the same suggestion.

On the dashboard, a banner tells me how many new Categories are suggested. Tapping it opens a review deck that shows one suggestion at a time, with its entries and total. Each suggestion takes one tap:

- "Yes, add it as Spending" or "Yes, as Money Movement", which adds the Category, moves its entries into it, and offers it to the LLM from then on
- "No, it's X" when it looks like a Category or another waiting suggestion
- "It's another category…" to merge it into any existing Category
- "Not a category" to dismiss it for good
- "Skip for now"

Every answer teaches the app that spelling, so I never review the same variant twice.

## User Stories

1. As the user, I want every Expense to still be filed under a Category from my list, so that the dashboard never shows a Category I haven't approved.
2. As the user, I want the LLM to suggest a new Category only when nothing on my list is a clear fit, so that I'm not asked about Expenses the list already covers.
3. As the user, I want suggestions to name a kind of expense rather than a Merchant, so that "Pet Supplies" is suggested and not "PetSmart".
4. As the user, I want Income never to carry a suggestion, so that this feature only shapes my expense Categories.
5. As the user, I want "Pet Supplies", "pet supply" and "Pet supplies" treated as one suggestion, so that spelling variants never become separate Categories or separate review cards.
6. As the user, I want a suggestion that is just another spelling of one of my Categories filed under that Category automatically, so that I'm never asked whether "Clothings" is Clothing.
7. As the user, I want Expenses that got the same suggestion grouped together with a count and total, so that I can judge how big the gap is.
8. As the user, I want a banner on the dashboard saying how many new Categories are suggested and from how many entries, so that I notice them without hunting.
9. As the user, I want the banner to disappear when nothing is waiting, so that it never clutters the dashboard for no reason.
10. As the user, I want to review suggestions one at a time in a deck, so that each decision gets my full attention and a review takes seconds.
11. As the user, I want to see the entries behind a suggestion and the Category each one is in right now, so that I know exactly what my answer will change.
12. As the user, I want to approve a suggestion as a Spending Category in one tap, so that the common case is effortless.
13. As the user, I want to approve a suggestion as Money Movement instead, so that a loan payment or a savings transfer never inflates my Spending.
14. As the user, I want approving to move the suggestion's entries into the new Category, so that history is right from the start.
15. As the user, I want to rename a suggestion before approving it by tapping its name, so that the Category reads the way I want.
16. As the user, I want approving to be refused when the name is just a spelling of a Category I already have, so that I can't create a duplicate by accident.
17. As the user, I want a "looks like X" answer when a suggestion resembles an existing Category, so that "Clothes" becomes Clothing in one tap.
18. As the user, I want a "looks like X" answer when a suggestion resembles another waiting suggestion, so that "Car Fuel" and "Gas & Fuel" are decided together.
19. As the user, I want the look-alike answer to be only an option and never applied automatically, so that "Pet Insurance" isn't silently merged into Insurance.
20. As the user, I want to merge a suggestion into any existing Category even when no look-alike was found, so that I can say "this is Groceries" myself.
21. As the user, I want merging to move the suggestion's entries into the Category I chose, so that the rows end up where they belong.
22. As the user, I want to dismiss a suggestion with "Not a category", so that its entries stay where they are and it stops asking.
23. As the user, I want a dismissed spelling never to come back as a suggestion, so that the deck only shows real questions.
24. As the user, I want to skip a suggestion I'm unsure about, so that it moves to the back of the deck without blocking the rest.
25. As the user, I want the deck to say "All caught up" when I've answered everything, so that I know I'm done.
26. As the user, I want any spelling I've merged, folded or approved to be recognized on future Expenses, so that I never review the same variant twice.
27. As the user, I want later suggestions that match a folded spelling to join the suggestion I folded them into, so that a fold keeps working until I decide.
28. As the user, I want an approved Category offered to the LLM on the very next Expense, so that new purchases of that kind are filed there directly.
29. As the user, I want an approved Category to appear in the dashboard's Category filter, breakdowns and the Modify sheet right away, so that it works like any other Category.
30. As the user, I want the Spending totals to respect each Category's Spending or Money Movement setting, so that my numbers stay honest as the list grows.
31. As the user, I want my existing Category Overrides to keep winning over the LLM, so that my earlier corrections stay in charge.
32. As the user, I want no suggestion raised for an Expense whose Merchant I've already overridden, so that I'm not asked about a Merchant I've already decided on.
33. As the user, I want ingest to keep logging my Expenses if the Category list can't be read, falling back to the built-in list, so that a problem here never loses a Transaction.
34. As the user, I want ingest to keep logging if my resolved spellings can't be read, so that a problem with the spellings sheet never loses a Transaction.
35. As the user, I want a failed answer in the deck to tell me it failed and keep that suggestion on screen, so that I never wrongly think a Category was added.
36. As the user, I want an answer to skip rows that changed or were deleted since the deck loaded, so that a review never overwrites an entry I just edited.
37. As the user, I want to see and hand-edit my Categories, their Spending flags and my resolved spellings directly in the Google Sheet, so that I don't need an admin screen.
38. As the user, I want the current 25 Categories carried over with their Spending settings when this ships, so that my dashboard totals don't change on deploy day.
39. As the user, I want the whole review flow to be comfortable on my iPhone, so that it fits how I actually use the dashboard.

## Implementation Decisions

- **Domain language.** Two new GLOSSARY terms:
  - **Category Suggestion:** the group of Expense rows whose Suggested Category normalizes to the same spelling.
  - **Category Spelling:** a normalized spelling the user has resolved, either as an alias of a Category (or of a waiting Suggestion) or as dismissed.

  **Category** is redefined: it is still closed at parse time, but the list now lives in the sheet and grows only by approval. The GLOSSARY's Category count is wrong today (26; the list has 25) and gets fixed.
- **The Category list moves into a new `Categories` sheet,** with columns Category, Counts as Spending and Added-at. The spreadsheet service creates it on first read and seeds it from the built-in list, with Transfers, Investments & Savings and Income marked as not Spending. The built-in list stays in code, but only as the fallback for when the sheet can't be read.
- **Spending is driven by the list.** The hard-coded Money Movement set in the analytics module is replaced by the Categories flagged as not Spending. That set is passed into the aggregation functions, which stay pure.
- **The LLM service takes the list per call.** The parse operation receives the current Categories. The fallback service passes them through to each provider. The response schema's Category enum and the prompt's allowed list are both built from them at request time. The schema gains an optional `suggested_category` string (nullable instead, if a provider's structured output requires it). The prompt says to suggest only when nothing is a clear fit, to name a short, general kind of expense (never a Merchant), and to suggest only for Expenses.
- **The suggestion is stored on the Transaction row, in a new column F, "Suggested Category".** Waiting Suggestions are derived from the rows: every row with a non-blank F, grouped by normalized F. No row numbers are stored anywhere, so deleting an entry can't misdirect a later write. Resolving a Suggestion clears F on its rows. Transaction reads widen to include F, and the writable columns grow to include F.
- **Resolved spellings live in a new `CategorySpellings` sheet,** with columns Spelling (normalized), Outcome (`Alias` or `Dismissed`), Target and Updated-at. Target is a Category or, after a fold, the label of a waiting Suggestion. When that Suggestion is approved under a different name, Targets pointing at its old label are rewritten to the new name.
- **Normalization is the only automatic merge.** It lowercases, turns `&` into "and", drops punctuation, and makes each word singular (`ies` becomes `y`; a trailing `s` is dropped unless it follows another `s`). It is applied to suggestions, Category names and spellings alike.
- **Ingest order.**
  1. Parse with the current list (or the built-in list if the read failed).
  2. Apply Category Overrides. An override also clears that Expense's suggestion.
  3. Check the suggestion, in the order below, which comes from the logic prototype:

  ```ts
  // From the logic prototype: first match wins.
  function checkSuggestion(suggestion, categories, spellings): Outcome {
    const key = normalize(suggestion);
    const same = categories.find((c) => normalize(c.name) === key);
    if (same) return { file: same.name };                 // a respelling; F stays blank
    const s = spellings[key];
    if (s?.outcome === 'Alias')
      return isCategory(s.target) ? { file: s.target }    // alias of a Category
                                  : { suggest: s.target }; // alias of a waiting Suggestion
    if (s?.outcome === 'Dismissed') return { drop: true };
    return { suggest: suggestion };                       // waits for review in F
  }
  ```

  A failed spellings read is logged, and ingest skips straight to writing F. A failed Categories read is logged, and ingest uses the built-in list. Neither failure loses the Transaction.
- **The look-alike hint** is the share of words two names have in common after normalization (ignoring "and", "the", "of", "for"), shown when it is 50% or more. It is computed against all Categories and the other waiting Suggestions, and a Category wins a tie. v1 uses no embeddings and no synonym folding. A fold by hand covers synonyms such as gas and fuel, and it is remembered.
- **A server function lists waiting Suggestions for the dashboard.** For each Suggestion it returns the label (the first-seen spelling), its entries with their current Category, the total, and the hint. This is what the banner and the deck render.
- **The review UI is a review deck** (variant C of the UI prototype), in the dashboard's ledger style:
  - A banner under the masthead says "N new categories suggested, from M entries that didn't fit the list · Review ›". It is hidden when nothing is waiting.
  - The banner opens a tall bottom sheet titled "N to review", showing one Suggestion at a time. Its name is the headline (tap to rename), followed by its entry count, its total, and its entries with their current Category.
  - The answers, in order:
    - "No, it's X", only when there is a hint. It merges into a Category or folds into a waiting Suggestion.
    - "Yes, add it as Spending" (primary).
    - "Yes, as Money Movement".
    - "Not a category" (dismiss).
    - "It's another category…", a picker over all Categories. This was added after the prototype, so a Suggestion with no hint can still be merged.
    - "Skip for now", which sends it to the back of the deck for this visit only.
  - After each answer the next Suggestion shows. An empty deck says "All caught up". A failed answer shows inline and keeps the Suggestion on screen.
- **Review answers are server actions,** following the existing Category correction action:
  - **Approve:** refuses a name that normalizes to an existing Category. Otherwise it adds the Category with the chosen Spending flag, records an alias for every spelling in the Suggestion, rewrites the Category of its rows, and clears F.
  - **Merge:** records the aliases to the chosen Category, rewrites the Category of its rows, and clears F.
  - **Fold:** records the aliases to the target Suggestion and rewrites F on its rows to the target's label.
  - **Dismiss:** records the spellings as `Dismissed`, clears F, and leaves the Category as it is.

  Every action re-checks a row's contents before writing to it, as Modify and Delete already do; rows that changed are skipped. Each action busts the same caches as ingest. Approving always moves the entries; the deck has no toggle for this.

  From the logic prototype, the decision shape:

  ```ts
  type Decision =
    | { kind: 'approve'; key: string; name: string; spending: boolean }
    | { kind: 'merge'; key: string; into: string }        // into an existing Category
    | { kind: 'fold'; key: string; into: string }         // into a waiting Suggestion's key
    | { kind: 'dismiss'; key: string };
  ```
- **The rest of the app uses the loaded list.** The Category type becomes a string validated against the loaded list. This covers the Modify sheet's options and its validation, the Category correction action, the override validation in the spreadsheet service, and the dashboard filters.
- **No auth,** consistent with the rest of the app.

## Testing Decisions

- **A good test checks external behavior only:** what ends up in the sheet (through the mock spreadsheet service), what an action returns, and what the dashboard aggregations report. It never checks how normalization or the hint compute their answers internally.
- **Seam 1, ingest (existing):** POST to the track-expense route with a mocked LLM and the mock spreadsheet service. This is the prior art of the route test for Category Overrides. It covers:
  - spelling variants landing in one Suggestion (normalization)
  - a respelling of a Category being filed there with F blank
  - an alias to a Category, and an alias to a waiting Suggestion
  - a dismissed spelling being dropped
  - an override clearing the suggestion
  - Income never getting F
  - a Category added to the list being accepted
  - the fallbacks when the Categories or spellings reads fail
- **Seam 2, review (new, at the highest point):** the review server actions, plus the server function that lists waiting Suggestions with their hints, against the mock spreadsheet service. The prior art is the Category correction action's test. It covers:
  - each of Approve, Merge, Fold and Dismiss, and what each writes
  - a duplicate name being refused
  - a fold followed by an approval under a new name
  - changed rows being skipped
  - hints in the listing: a Category look-alike, a Suggestion look-alike, a Category winning a tie, and none below 50%
- **Seam 3, aggregation (existing):** the aggregate tests gain a case where a Category flagged as not Spending is excluded from Spending.
- Normalization and the hint get no direct unit tests. They are covered through seams 1 and 2.
- There are no component tests, matching the repo. The deck is checked by hand at 375px and on the user's iPhone.
- The real-LLM integration test is left unchanged. Before shipping, prompt quality is checked by hand on a few real card-feed Motives across groq, deepseek and mistral: does it suggest only when nothing fits, and is the optional field returned reliably?

## Out of Scope

- Splitting Income into several Categories. It's a separate effort, and v1 never suggests for Income.
- Renaming, deleting or re-flagging an existing Category from the app. The sheet is the admin UI for that, as it is for overrides.
- Embedding-based similarity, synonym folding, and any automatic merge beyond normalization.
- Parent groups for Categories (Food, Housing …). Approval decides only the Spending flag.
- A toggle to approve without moving entries.
- Changing how Category Overrides work.
- Auth.

## Further Notes

- **Done means** shipped to production and verified on the user's iPhone with the motivating case: pet expenses from PetSmart and Chewy end up under one approved "Pet Supplies" Category, and the next pet purchase is filed there directly.
- **Tracker:** local markdown, like the other maps. Tickets live in `tickets/`, one file each, with `status`, `assignee`, `labels` and `blocked-by` header fields.
- **Shipping** means merging to main, which Vercel auto-deploys in about 8 minutes. No PR.
- **Carried constraints:** mobile-first, no database, Sheets is the source of truth. Consult [GLOSSARY.md](../../../GLOSSARY.md).
- **Prototypes:** both are kept off main as primary sources.
  - The logic prototype is on branch `prototype/open-categories`, as a single HTML file with walkthroughs. Its pure module is the starting point for normalization, the suggestion check and the review reducer.
  - The UI prototype is on branch `prototype/open-categories-ui`. Run `npm run prototype:suggestions`, then open `/dashboard?variant=C`. Its review deck is the visual reference; rewrite it properly rather than copying it.
- **Open questions:**
  - Is a dismissal permanent, or should a dismissed spelling come back after N entries? v1 makes it permanent, and the spelling's sheet row can be deleted by hand.
  - Does every provider in the fallback chain return the optional field reliably? Ticket 0005 checks this, and the field becomes nullable if needed.

## Decisions so far

<!-- one line per closed ticket -->
- 0001 (2026-10-14): The logic prototype validated #2 + #3. Normalization is the only automatic merge, look-alike scores are only hints, and approval forces the Spending decision.
- 0002 (2026-10-14): The review deck (variant C) won over a dashboard section (A) and chips on the entries (B).
- 0006 (2026-10-14): Category Spellings live in a CategorySpellings sheet (upsert by normalized spelling). Merge and Approve record the Suggestion's key as an Alias. The look-alike hint matches word stems (5+ shared letters) so Clothes hints Clothing.
- 0008 (2026-10-14): Any answer to a Suggestion (not just Approve) re-records the spellings folded into it with the same outcome and target, so Merge, Dismiss and a second fold never leave an Alias pointing at a label no longer waiting. The ticket's demo pair "Car Fuel"/"Gas & Fuel" shares only 1 word of 3 (33%), so it gets no hint; "Fuel"/"Gas & Fuel" (50%) does.
