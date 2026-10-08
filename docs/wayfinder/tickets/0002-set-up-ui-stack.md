# Set up UI stack

status: closed
assignee: claude (this session)
labels: wayfinder:task
blocked-by: (none)

## Question

(Execution ticket — map's execution override.) Install and configure Tailwind CSS, shadcn/ui, and Recharts in this Next.js 15 / React 19 app (currently plain CSS modules, no UI libs). Follow the vercel:shadcn skill. Done when: a trivial `/dashboard` page renders a shadcn Card and a Recharts chart with Tailwind styles, dev server clean, existing tests still pass. Keep `globals.css` changes minimal and don't break the starter page yet (it gets replaced later by the redirect in the Dashboard UI ticket).

## Resolution

Done on branch `dashboard`, commit "Set up UI stack: Tailwind v4, shadcn/ui, Recharts".

- Tailwind v4 via `@tailwindcss/postcss` (new `postcss.config.mjs`); `@import "tailwindcss"` prepended to `globals.css`, starter styles preserved below the shadcn theme blocks.
- `npx shadcn init -d`: style **base-nova**, **@base-ui/react primitives** (not Radix — fine, no AI Elements here), neutral palette, `cn` from the `cn` package, `components.json` at repo root. Components added: button, card, table, tabs, select, badge, separator, skeleton, sheet, input, label, dropdown-menu, scroll-area → `src/components/ui/`.
- `recharts` installed.
- Applied the known shadcn/Geist gotcha fixes: literal font names in `@theme inline` (the init writes a circular `--font-sans: var(--font-sans)`), font variable classNames moved from `<body>` to `<html>`.
- Removed stale `yarn.lock` — it made the shadcn CLI try (missing) yarn; npm + package-lock.json is the package manager.
- Smoke `/dashboard` page (Card + Recharts bar chart) renders correctly, starter `/` page intact, no console errors. `tsc --noEmit` clean.
- Test suite: 4/5 pass. The failing one ("scenario 4 — fallback to openai") is a live-LLM integration test returning 500 from the real OpenAI call — pre-existing/environmental, untouched by this ticket; worth a look before the ship ticket.
- Bonus: `.claude/launch.json` added so sessions can preview the dev server by name.
