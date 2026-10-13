# Map: Category Corrections & Merchant Memory

labels: `wayfinder:map`, `ready-for-agent`
tickets: [tickets/](tickets/)
status: open

## Destination

Shipped to production: the user can fix a wrong Category from the dashboard in one tap. The fix applies to the whole Merchant, repairs every past row in the sheet, and is remembered so that new Transactions from that Merchant arrive correctly categorized. Verified on the user's iPhone with the motivating case, "N1co*las Brumas N1co", which was filed as Shopping — General and should be Dining Out.

## Problem Statement

The LLM parser sometimes picks the wrong Category. Processor-prefixed Motives like `N1co*las Brumas N1co` are the main culprit, and the data audit found about 10 miscategorized rows out of 664. Today nothing can be done about it in the app. There is no way to correct a Category, so the dashboard's Spending breakdowns stay wrong. The same Merchant also gets misfiled again on every future purchase, because nothing is remembered between parses.

## Solution

Tapping an entry's Category on the dashboard opens a picker. Choosing a Category saves a **Category Override** for that entry's Merchant, which means it applies to every Transaction from that Merchant, not just the one tapped. Saving does two things:

1. **Repairs history.** It immediately rewrites the Category cell of every existing row whose Motive clusters to that Merchant, so the sheet itself becomes correct and not just the app's view of it.
2. **Remembers it.** When a new Transaction is ingested and its Motive clusters to a Merchant that has an override, the override's Category is written instead of the LLM's guess.

## User Stories

1. As the user, I want to tap a Transaction's Category in the dashboard entries list, so that I can correct it the moment I notice it is wrong.
2. As the user, I want the picker to offer exactly the fixed Category list, so that I can't create a Category the rest of the app doesn't know.
3. As the user, I want the picker to tell me the change applies to all expenses from that Merchant, so that I'm not surprised when other rows change too.
4. As the user, I want every past Transaction from that Merchant recategorized at once, so that I don't have to fix rows one by one.
5. As the user, I want the Google Sheet itself to hold the corrected Category, so that the source of truth is right for any consumer and not just patched in the app.
6. As the user, I want the dashboard to reflect the correction immediately after I save, so that I can trust it took effect.
7. As the user, I want new Transactions from a corrected Merchant to arrive with my chosen Category, so that I never correct the same Merchant twice.
8. As the user, I want correcting a Merchant again to replace the previous override, so that I can change my mind without a management screen.
9. As the user, I want Merchants I've never corrected to keep being categorized by the LLM, so that new places still get a sensible guess.
10. As the user, I want corrections to only ever touch the Category column, so that dates, Motives, amounts and Types stay exactly as they were logged.
11. As the user, I want variants of the same Merchant (for example `N1co*las Brumas N1co` and `N1CO*LAS BRUMAS`) to be corrected together, so that the existing Merchant clustering decides what counts as "the same place".
12. As the user, I want to make corrections comfortably on my iPhone, so that the feature fits how I actually use the dashboard.
13. As the user, I want a failed save to tell me it failed, so that I don't wrongly believe a Merchant was corrected.
14. As the user, I want ingest to keep working even if the overrides sheet can't be read, so that a correction-memory problem never loses a Transaction.
15. As the user, I want to be able to inspect or delete overrides directly in the Google Sheet if I ever need to, so that I don't need an admin UI.

## Implementation Decisions

- **New domain term: Category Override.** This is a Merchant → Category mapping chosen by the user. Merchant is no longer purely presentational. It is still derived at display time and Motives are still never altered, but it now also keys overrides. GLOSSARY.md gets updated to match.
- **Storage: a new `CategoryOverrides` sheet** in the same spreadsheet, with columns Merchant, Category and Updated-at. There is one row per Merchant, and saving again for the same Merchant updates that row. No database, which is consistent with "Sheets is the source of truth".
- **Override key is the output of the existing Merchant clustering function**, applied to the Motive. If that regex changes and renames a Merchant, its override detaches silently. That is an accepted risk: the only consequence is that the LLM's guess shows again.
- **Overrides are Merchant-level only.** There is no per-Transaction override.
- **The spreadsheet service interface is extended** with three operations, and the mock implementation mirrors all of them:
  - read all overrides
  - upsert one override
  - batch-rewrite the Category of a given set of rows
- **Row identity comes from the sheet's row order.** The read already walks rows top-down from row 2, so each row's sheet row number is known at read time. This is safe because rows are never deleted or reordered; appends only add rows at the bottom. Readers must keep the row number even for rows that parse into Transactions.
- **Correction is a server action.** It takes a Merchant and a Category, validates the Category against the closed list, and then:
  1. upserts the override
  2. reads all rows
  3. picks out the rows whose Motive clusters to the Merchant and whose Category differs
  4. batch-rewrites those Category cells
  5. busts the same caches ingest busts

  It runs synchronously, because 664 rows takes well under the function timeout, and it returns the number of rows repaired.
- **Ingest applies overrides after the LLM parse.** For each parsed Transaction, if the Merchant of its Motive has an override, the override's Category replaces the LLM's. The single LLM call is unchanged, because it still has to parse the Motive, amount and Type. Saving API calls was explicitly dropped as a goal. If reading the overrides fails, ingest logs the error and continues with the LLM's categories.
- **Picker UI.** The Category label on each row of the dashboard entries list becomes a tap target that opens a native `<select>` of the fixed Category list, with an "applies to all \<Merchant\> expenses" hint. It is mobile-first, and on failure it shows an inline error.
- **Write scope.** The app may rewrite only the Category column of existing rows. Date, Motive, amount and Type stay append-only. This reverses the dashboard-v2 decision that existing rows are never edited, for the Category column only, at the user's request (grilling, 2026-10-12).
- **No auth on the correction action**, consistent with the open ingest endpoint. This is a conscious, accepted risk.

## Testing Decisions

- Tests exercise external behavior through the highest seams only:
  - **Ingest:** the existing `POST /api/track-expense` integration test seam, with mocked LLM and spreadsheet services.
  - **Correction:** a new seam at the correction server action, run against the mock spreadsheet service.
- Merchant matching is exercised through these seams and not unit-tested in isolation. Existing Merchant clustering tests stay as they are.
- There are no UI or component tests, which matches the repo's current practice. The picker is a thin `<select>` over the server action, and the UI is verified by manual QA at 375px and on the user's iPhone.
- Prior art is the route integration test and the read-transactions integration test.

## Out of Scope

- Saving LLM API calls, and any deterministic pre-parser that skips the LLM.
- Per-Transaction (one-off) Category edits.
- Editing any column other than Category.
- A UI to list, inspect or delete overrides. The sheet itself serves that purpose.
- Auth.
- Teaching the parse prompt the Processor*Merchant convention. That is still an open idea from dashboard-v2, and overrides make it less pressing.

## Notes

- Tracker: local markdown, using the same conventions as dashboard-v2. Tickets live in `tickets/`, one file each, with `status`, `assignee`, `labels` and `blocked-by` header fields.
- Shipping means merging to `main`, which Vercel auto-deploys in about 8 minutes. No PR.
- Carried constraints:
  - Mobile-first is a hard requirement.
  - No database.
  - Consult [GLOSSARY.md](../../../GLOSSARY.md).

## Decisions so far

<!-- one line per closed ticket -->
