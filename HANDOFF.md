# MTG Intel — Session Handoff

**Date:** 2026-06-12 (end of day)
**Branch:** master (clean; `feat/ui-overhaul-phase-a` not yet created)
**Last commit:** f79a198 (UI overhaul Phase A plan)
**Prod:** https://mtg-intel.vercel.app · GitHub: brandonliming-spec98/mtg-intel · Supabase project `xpdnqsxxevhbkqdjpksc`

---

## TL;DR — where we are

1. **Projections Dashboard (Phase 3)** — fully built, deployed, live. DB tables + 8 starter algorithms seeded.
2. **Data backend was badly broken; now fixed and live.** MTGStocks API died, PullPush (Reddit) died, Scryfall started 400ing header-less requests, and Vercel was stuck on a June-8 build. All repaired and deployed.
3. **UI overhaul (Phase A) is fully designed and planned.** Spec + 13-task TDD plan committed. **Next action: execute the plan** on branch `feat/ui-overhaul-phase-a`.

---

## START HERE TOMORROW

Execute the UI overhaul Phase A plan:

- **Plan:** `docs/superpowers/plans/2026-06-12-ui-overhaul-phase-a.md` (13 bite-sized TDD tasks, complete code in each)
- **Spec:** `docs/superpowers/specs/2026-06-12-ui-overhaul-design.md`
- **How:** use `superpowers:subagent-driven-development` (recommended) — fresh subagent per task, spec + code-quality review between each.
- **Task 1 creates the branch** `feat/ui-overhaul-phase-a`. Ends with a PR for the user to review (do NOT commit UI work to master; do NOT merge without review).
- When the session ended, the user was being offered execution options 1 (Subagent-Driven) vs 2 (Inline). Confirm the choice before dispatching.

**What Phase A delivers:** card-first landing (Direction C: search → art nav tiles → "Hot right now" flip-card grid → movers ticker), a universal `CardTile` (every card flips to reveal its chart — a refactor of `ProjectionFlipCard`, kept as a thin re-export), shared components (`SectionLabel`, `NavTile`, `MoversTicker`, `ManaNebula`), a restrained 3-tier motion system gated by `prefers-reduced-motion`, and a slimmer NavBar. Phase B (rebuild market/hot/intel/watchlist/card-detail on these components) is a separate future spec.

---

## What got fixed today (data backend recovery — all live on prod)

Root causes and fixes (all merged to master, deployed via `npx vercel deploy --prod --yes`):

| Broken | Fix | Commit |
|---|---|---|
| Vercel stuck on June-8 build | Hourly push-notify cron violates Hobby plan (daily only) → changed to `0 12 * * *` | 5a91890 |
| Build failing on type errors | `urlBase64ToUint8Array` typed `Uint8Array<ArrayBuffer>` | 75a9f50 |
| Intel feed / hot / projections empty | `intel_signals` + `card_mechanics` server modules used anon key against RLS tables → switched to `SUPABASE_SERVICE_ROLE_KEY` | faada54 |
| Reddit ingestion 0 posts | PullPush API dead + reddit.com JSON 403s datacenter → switched to Reddit Atom RSS (`/r/{sub}/top/.rss`) | 1874237 |
| Prices broken | MTGStocks API gone (302→/error/404) → Scryfall primary (named + cheapest-priced-print fallback) | 712aa80 |
| No price history | MTGStocks backfill gone → accrue our own daily snapshots in `price_snapshots` (migration 006 adds `card_name`) | 71678c9 |
| Market movers empty | MTGStocks interests gone → scrape MTGGoldfish `/movers/paper/all` | a7565a8 |
| Signal extraction silently 0 | Scryfall catalog fetch 400'd (no headers) + noisy sub-name matches → added headers, word-boundary + substring filtering | d5d1a5b |
| Snapshot/algo/feedback writes never ran | Bare fire-and-forget promises freeze when Vercel returns the response → `next/server` `after()` | 4722d1b |

**Data state in prod:** 21 real intel signals seeded (manually inserted from a live Reddit run); movers live (19 cards); prices live via Scryfall; price history starts accruing now (1 snapshot/card/day — charts will be sparse for ~2 weeks). Reddit ingest cron runs 8:00 UTC daily, YouTube 9:00 UTC (YouTube path still UNTESTED — check Vercel logs after first run).

**Security:** RLS enabled on `card_projections`, `projection_algorithms`, `push_subscriptions` (migration 005). All server routes use service-role key (bypasses RLS); anon key never touches these tables.

---

## Projections Dashboard (Phase 3) — done & live

- Tables `card_projections` + `projection_algorithms` (migrations 003/004); RLS on (005).
- 8 pre-promoted `starter-*` algorithms seeded so projections work WITHOUT the Claude API.
- Surfaces: `/watchlist` Projections tab (flip-card gallery), `/cards/[id]` ProjectionPanel, `/api/projections/[cardName]` (cache→algorithm→Claude fallback), `/api/projections/[id]/validate`.
- `ProjectionFlipCard` is the flip card Phase A generalizes into `CardTile`.

---

## Standing user directives (in memory/ — read MEMORY.md)

- **Feature-branch + PR for every phase** — never develop on master. (We slipped on Projections; corrected.)
- **UX bar = Scryfall + Moxfield**; approved brainstorm mockups are the source of truth for UI, not loose inspiration. Also pull from edhrec.com, manapool.com, echomtg.com.
- **No Claude API spend yet** — every Claude feature must have a deterministic fallback. Projections → 8 seeded `starter-*` algorithms; signal extraction → rule-based; mechanics → tier 1/2.

---

## Environment notes

- **Deploy:** GitHub→Vercel webhook is DEAD. Deploy with `npx vercel deploy --prod --yes` (CLI). Confirms with `"status":"ok"`.
- **Vercel plan:** Hobby — crons must be daily or less frequent (no sub-daily schedules).
- **`ANTHROPIC_API_KEY`** intentionally not set in Vercel (user deferring spend). If it IS present from Phase 2, Claude features light up automatically.
- **computing-mcp** (deep-math MCP) registered at user scope, but Docker isn't installed on this machine — verify Docker before relying on it.
- **Local ingest run:** `npx tsx scripts/run-reddit-ingest.ts` (self-loads `.env.local`).
- **Tests:** `npm test` (vitest, 179 passing pre-overhaul). **Build:** `npm run build`.

## Prod URLs
- App: https://mtg-intel.vercel.app
- GitHub: https://github.com/brandonliming-spec98/mtg-intel
- Supabase: project `xpdnqsxxevhbkqdjpksc`
