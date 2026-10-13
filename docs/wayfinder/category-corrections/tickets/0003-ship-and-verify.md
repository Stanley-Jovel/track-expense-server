# Ship and verify Category corrections in production

status: open
assignee: —
labels: wayfinder:task
blocked-by: 0001, 0002

## What to build

Merge to `main`, which Vercel deploys in about 8 minutes, and verify in production:

1. The `CategoryOverrides` sheet exists, or is created by the first save, in the production spreadsheet.
2. The live dashboard at 375px shows the Category picker.
3. The user corrects Las Brumas to Dining Out on their iPhone. Every Las Brumas row in the Google Sheet now reads Dining Out.
4. The next real purchase from a corrected Merchant arrives correctly categorized.

Steps 3 and 4 are the user's call to perform: they change real data, or depend on a real purchase.

## Acceptance criteria

- [ ] Deployed to production from `main`.
- [ ] Picker verified live at 375px.
- [ ] The user has corrected Las Brumas, and the sheet shows the repair.
- [ ] The map's Decisions section is updated and the map is closed.

## Resolution
