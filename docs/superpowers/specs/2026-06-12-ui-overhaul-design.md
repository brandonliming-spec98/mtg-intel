# Design: UI/UX Overhaul

**Date:** 2026-06-12
**Status:** Approved
**Scope:** Phase A — design system + landing page + navigation + universal flip CardTile + motion system. (Phase B, the rebuild of market/hot/intel/watchlist/card-detail on these components, is a separate spec.)

---

## Context

The data backend is live again, but the user judged the visual experience "a page out of MySpace in 1998 — very busy." Earlier brainstorming produced polished HTML mockups (`design-ui-flip.html`, `design-ui-card-v3.html`) that were never reflected in the shipped UI. This overhaul makes those mockups the app's actual visual language and raises the bar to match scryfall.com, moxfield.com, edhrec.com, manapool.com, and echomtg.com: **card art front and center, tile-based navigation with MTG art, calm dark surfaces, restrained premium motion.**

The work ships in two phases so the new look is visible quickly. This spec covers **Phase A**: the design system and the landing page, plus the shared components and motion system that Phase B will reuse. Phase A runs on branch `feat/ui-overhaul-phase-a` with a PR the user reviews.

---

## Design Principles (the de-MySpace pass)

1. **One quiet surface.** Background `#0a0a0f`. Surfaces `#13131b` / `#16161f`. Borders `#23232f` / `#2a2a3a`. Remove the rainbow gradient bar (`--rainbow-bar`), competing glows, and stacked borders from the current CSS.
2. **Gold is an accent, not a texture.** `#d4a843` / `#e8c062` only for section labels, hairline rules, hover states, and the brand. Never as fills or full-width bars.
3. **Color encodes data, not decoration.** Bull green `#22c55e`, bear red `#ef4444` appear only on prices, deltas, verdicts, and signals.
4. **Card art is the only loud element.** Every page leads with card imagery; chrome stays muted around it.
5. **Type roles are fixed.** Serif (Playfair Display / Georgia) for card names and the brand only. JetBrains Mono for all data, labels, and UI text. Generous whitespace; radius 10–12px throughout.
6. **Motion is ambient and rationed** (see Motion System). The resting page is effectively still.

These tokens live in `app/globals.css` `:root` and a small `lib/design-tokens.ts` (motion durations/easings as named constants) so components reference one source.

---

## Landing Page (`app/page.tsx`, rebuilt — Direction C)

Top to bottom, matching the approved `landing-final.html` / `landing-motion.html` mockups:

1. **Top row** — brand wordmark `MTG<b>Intel</b>` (serif, gold/white) on the left; compact search bar on the right (`SearchBar`, existing component, restyled with the focus-glow treatment).
2. **Navigation tiles** — a 4-up grid of `NavTile` components (Market / Hot / Intel / Watchlist). Each shows a card `art_crop` background at ~28% opacity behind a dark scrim, a serif label, and a live count (e.g., "19 movers", "21 signals"). Counts come from lightweight server fetches (`/api/movers`, `/api/hot`, `/api/intel`) with graceful fallback to no count.
3. **"Hot right now"** — a `SectionLabel` (gold uppercase + fade rule) over a 5-up responsive grid of `CardTile` flip cards (see below), sourced from `/api/hot`. While hot data is still accruing, fall back to top entries from `/api/movers`.
4. **"Today's movers"** — a slim `MoversTicker` (single-row marquee) of `/api/movers` gainers/losers.

Mobile: nav tiles become 2-up, card grid 2-up, ticker unchanged. A bottom tab bar (Market / Hot / Intel / Watchlist) appears under `md`.

---

## Shared Components (the Phase B toolkit)

### `CardTile` — the universal flip card
**Every card in the app is a flip card.** Front shows card art + price + delta + optional BUY/SELL ribbon; clicking flips it (CSS 3D `rotateY`, `transform-style: preserve-3d`, `backface-visibility: hidden`) to a back face showing the **price/projection chart**. This is a refinement of the existing `components/ProjectionFlipCard.tsx`, which already implements the front→back flip with `ProjectionChart` on the back.

- **Approach:** rename/refactor `ProjectionFlipCard` into `CardTile` (keep a thin `ProjectionFlipCard` re-export so existing imports in `watchlist` and `ProjectionPanel` keep working until Phase B migrates them). `CardTile` takes the card identity (name, set, collector number, image, type line), an optional `Projection`, and `PricePoint[]` history.
- **Front:** full-bleed `art_crop`/`normal` image, price + 24h delta overlay (bottom), optional verdict ribbon (top-left) using the verdict palette already in `ProjectionFlipCard`.
- **Back:** `ProjectionChart` sparkline + verdict/confidence + reasoning when a projection exists; when there's only price history (no projection yet), the back shows the price sparkline alone with current/period prices. Never a dead back.
- **Flip trigger:** click/tap toggles. On the card-detail page the back is shown directly (`showBack`), as today.
- **Foil sheen** (motion #1) applies to the front on hover.

### `NavTile`
Art-backed navigation tile: `art_crop` image at low opacity, dark gradient scrim, serif label, optional count, gold-hairline-trace hover (motion #4). Links to a destination page.

### `SectionLabel`
Gold uppercase mono label with a trailing fade hairline rule (`::after` gradient). Used for "Hot right now", "Today's movers", and every Phase B section header.

### `MoversTicker`
Single-row marquee of gainers/losers with edge mask-fade. Phase A ships a CSS-only constant-velocity loop; the hover-decelerate physics (motion concept #5) is deferred to Phase B.

### `NavBar` (restyle)
Slim: brand + text links + search affordance on desktop; bottom tab bar on mobile. Drop the current heavier treatment.

---

## Motion System

A strict three-tier hierarchy; at most one tier animates in any given second. All five concepts are gated behind a single `@media (prefers-reduced-motion: reduce)` rule (plus a `--motion-ok` check for JS-driven pieces) that disables every animation and renders the nebula static. The page must be 100% complete and usable with motion off.

**Tier 1 — ambient (unprompted):**
1. **Mana Nebula** — three huge radial-gradient blobs (desaturated island-blue `#1a2440`, swamp-violet `#2a1f3d`, faint gold at ≤4% opacity) drifting on independent 90s/120s/150s `linear` GPU `translate` loops, ~60px travel, total added luminance ≤6%. CSS-only, fixed layer behind landing content; static on other pages. Pause on tab-hidden. Tokens cap opacity in one place.

**Tier 2 — reactive (hover, one-shot, never looping):**
2. **Foil Sheen** — on `CardTile` front hover, a gold-weighted holographic band sweeps once across the art (650ms, `cubic-bezier(0.22,1,0.36,1)`, `mix-blend-mode: color-dodge`, rainbow fringe ≤20% opacity). Plus tile lift + border→gold + shadow (250ms). CSS-only; tap-fires once on mobile.
3. **Gold Hairline Trace** — on `NavTile` hover, a 1px `#d4a843` line traces the rounded-rect perimeter (SVG `stroke-dashoffset`, 500ms `ease-out`, holds at 50%), art opacity eases 28%→50%, label brightens to `#e8c062`. CSS-only.

**Tier 3 — momentary (once per session, then gone):**
4. **Opening Hand** — landing sections enter `opacity 0→1` + `translateY(14px→0)`, 450ms `cubic-bezier(0.16,1,0.3,1)`, staggered 90ms between sections and 40ms between grid tiles, **total budget ≤1.2s** (tiles after the 8th enter together). Content is interactive immediately. Gated once per session via `sessionStorage`; later navigations do a single 250ms group fade-rise.
5. **The Top Card** — to avoid two conflicting flip meanings on one element, the signature moment is the lead Hot tile receiving, on first load only, a foil sweep (concept #2's gradient) plus one sonar ping on its BUY/SELL ribbon (1px expanding ring, 900ms `ease-out`) and a gentle settle. It does **not** use a face-down→face-up flip, because the click-to-flip art↔chart interaction owns the card's flip axis. Once per session via `sessionStorage`.

Durations share a token scale (200/250/450/650/700/900ms) on one easing family; gold `#d4a843` is the connective thread. Deferred to Phase B: Ticker physics, Price Settle (data tick), Sonar Ping on all signals, Specular Tilt extension, Ember Drift (shelved).

---

## Data Flow & Error Handling

- Landing fetches `/api/hot`, `/api/movers`, and lightweight counts server-side (page is a Server Component); `CardTile` projection/price detail loads through the existing `/api/projections/[cardName]` + `/api/prices` paths (client) as `ProjectionPanel` does today.
- Every data source degrades gracefully: missing hot data → movers fallback; missing counts → label without count; missing projection → price-only chart back; all already-empty API shapes (`{average:[],foil:[]}`, `[]`) render calm empty states, never errors.
- No new backend work; the data layer fixed earlier today is sufficient.

---

## Testing

- Component render tests (vitest) for `CardTile` (front renders, flip toggles state, back renders chart vs price-only), `NavTile` (label + count + link), `SectionLabel`, `MoversTicker` (marquee content, empty state).
- Landing page renders all sections with mocked API data and with empty/fallback data.
- Motion is CSS-driven and asserted structurally (classes/keyframe hooks present, `prefers-reduced-motion` disables), not animation-timed.
- Manual visual check against `landing-motion.html` before the PR.

---

## Out of Scope (Phase A)

- Rebuild of market/hot/intel/watchlist/card-detail pages (Phase B, separate spec — they keep working on current styling until then).
- Tier-3/Phase-B motion concepts listed above.
- Any backend/data changes.
- View Transitions API page morphs (a strong Phase B candidate, not Phase A).
