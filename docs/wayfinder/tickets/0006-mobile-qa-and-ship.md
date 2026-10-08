# Mobile QA and ship

status: closed
assignee: claude (this session)
labels: wayfinder:task
blocked-by: [Dashboard UI](0005-dashboard-ui.md)

## Question

(Execution ticket, HITL at the end — user verifies on their actual phone.) QA the dashboard at mobile viewport (375px) in the browser: every chart legible, filters usable with a thumb, table scrolls sanely, no horizontal overflow, loading state acceptable on a cold cache. Fix what's found. Then ship: push to main, let Vercel deploy, verify the production URL renders real data, and hand the user the link to check on their iPhone.

## Progress

**Mobile QA at 375×812 (dev): pass.**
- No horizontal overflow (scrollWidth 375 = viewport); all tap targets ≥32px (the 1×1 hits are base-ui's hidden form inputs, not real targets).
- Category select opens with all 24 items on screen and selection filters the view and the URL (`?c=Groceries`); search narrows the list ("texaco" → 2 rows); charts legible; transaction rows comfortable.
- Found and fixed pre-ship: `/dashboard` prerendered fully **static**, which would freeze sheet data at build time on Vercel — added `export const revalidate = 60` (ISR confirmed via `initialRevalidateSeconds: 60` in the prerender manifest).

**Ship:** production build clean; tests 33/34 (the one failure is the pre-existing live-OpenAI "scenario 4" integration test — external key/quota issue, unrelated). Merged `dashboard` into `main` (remote tip was a content-identical merge wrapper of our base) and pushed. Awaiting Vercel deploy verification at track-expense-server.vercel.app/dashboard.

**Deploy verified:** Vercel picked up the push (took ~8 min); https://track-expense-server.vercel.app/dashboard renders live sheet data (July 2026, 1 transaction, all sections present) and `/` redirects to `/dashboard`. Remaining: the user's own check on their iPhone — the HITL tail of this ticket.

## Resolution

User confirmed the dashboard looks good on their iPhone. QA, fixes (ISR revalidate), merge to main, Vercel deploy, and production verification are all recorded above. Shipped at https://track-expense-server.vercel.app/dashboard.
