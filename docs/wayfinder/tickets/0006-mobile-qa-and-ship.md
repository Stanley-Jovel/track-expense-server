# Mobile QA and ship

status: open
assignee: claude (this session)
labels: wayfinder:task
blocked-by: [Dashboard UI](0005-dashboard-ui.md)

## Question

(Execution ticket, HITL at the end — user verifies on their actual phone.) QA the dashboard at mobile viewport (375px) in the browser: every chart legible, filters usable with a thumb, table scrolls sanely, no horizontal overflow, loading state acceptable on a cold cache. Fix what's found. Then ship: push to main, let Vercel deploy, verify the production URL renders real data, and hand the user the link to check on their iPhone.
