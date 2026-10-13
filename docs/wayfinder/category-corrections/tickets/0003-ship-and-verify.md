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

- [x] Deployed to production from `main`.
- [x] Picker verified live at 375px.
- [ ] The user has corrected Las Brumas, and the sheet shows the repair.
- [ ] The map's Decisions section is updated and the map is closed.

## Resolution

Progress (2026-10-12): shipped as main 290b823. The Vercel production deploy succeeded. Checked live at 375px:
- Every expense entry has a native picker with a 16px font.
- The hint reads "Applies to all <Merchant> expenses".
- The placeholder value is empty, so choosing the current Category still saves.
- There is no horizontal scroll.
- Las Brumas still shows Shopping — General, waiting on the user's correction.

Still open: the user corrects Las Brumas on their iPhone and confirms the sheet repair, and the next real purchase from that Merchant arrives correctly categorized.
