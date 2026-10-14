# 0006: Respellings and merging into an existing Category

status: open
assignee: —
labels: wayfinder:task, ready-for-agent
blocked-by: 0005

## What to build

Suggestions that mean a Category the user already has stop needing review:

- **At ingest,** a suggestion that normalizes to an existing Category's name is filed under that Category, with F left blank.
- **In the deck,** a Suggestion that looks like an existing Category gets the answer "No, it's X". The look-alike test is sharing at least half of its words after normalization.
- **Any Suggestion** can be merged with "It's another category…", a picker over all Categories.
- **Merging** moves the Suggestion's entries into the chosen Category, clears F, and records each of its spellings in a new `CategorySpellings` sheet (Spelling, Outcome, Target, Updated-at) as an `Alias` of that Category.
- **Later suggestions** with a recorded spelling are filed under its Category at ingest. Approving (0005) records its spellings too.
- **If the spellings can't be read,** ingest logs the failure, skips that check and logs the Transaction anyway.

The look-alike answer is only an option and never applied automatically. The [logic prototype ticket](0001-open-categories-prototype.md) explains why: "Pet Insurance" looks just as much like Insurance as "Clothes" looks like Clothing.

Demo: UNIQLO gets the suggestion "Clothes". The deck offers "No, it's Clothing", and tapping it moves the entry. The next "Clothes" suggestion is filed under Clothing silently.

## Acceptance criteria

- [ ] The spreadsheet service, both real and mock, reads the `CategorySpellings` sheet and records spellings in it, creating the sheet when it's missing.
- [ ] The ingest check runs in this order: a respelling of a Category, then an `Alias` spelling, otherwise write F.
- [ ] The listing function adds a hint to each Suggestion: the Category with the highest share of words in common, at 50% or more, ignoring "and", "the", "of" and "for".
- [ ] The Merge server action records the aliases, rewrites the Category of the Suggestion's rows, clears F, skips changed rows, and busts the caches.
- [ ] Approve now records aliases for every spelling in the Suggestion.
- [ ] The deck shows "No, it's X" only when there's a hint, and "It's another category…" always.
- [ ] Tests:
  - At the ingest seam: a respelling is filed under its Category with F blank, an alias is filed under its target, and a failed spellings read still logs the Transaction.
  - At the review seam: a Category look-alike hint, no hint below 50%, Merge moving rows and recording aliases, and Approve recording aliases.
- [ ] GLOSSARY.md defines Category Spelling.
- [ ] Lint, type-check and the full test suite pass.
