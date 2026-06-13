# UI/UX Overhaul Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the busy landing page with a calm, card-first experience (Direction C) and ship the shared component + motion toolkit the rest of the app will be rebuilt on in Phase B.

**Architecture:** A Server Component `app/page.tsx` fetches landing data through small lib functions (`lib/hot-cards.ts`, `lib/landing.ts`) and hands it to a client `LandingClient` that renders four sections — search row, art nav tiles, "Hot right now" flip-card grid, movers ticker — and owns the once-per-session entrance motion. The flip card becomes a single universal `CardTile` (a generalized refactor of the existing `ProjectionFlipCard`, which stays as a thin re-export). A three-tier motion system (ambient Mana Nebula · hover Foil Sheen + Gold Trace · once-per-session Opening Hand + Top Card) lives mostly in `globals.css`, all gated behind `prefers-reduced-motion`.

**Tech Stack:** Next.js 19 (App Router, Server + Client Components), React 19, TypeScript, Tailwind, vitest + @testing-library/react (jsdom). Scryfall card images are loaded by URL (`https://api.scryfall.com/cards/named?exact=NAME&format=image&version=normal`) — no API call needed. AGENTS.md rule: this is a modified Next.js; consult `node_modules/next/dist/docs/` before writing framework code.

**Branch:** All work on `feat/ui-overhaul-phase-a`, opened as a PR for review at the end (per project workflow — never commit UI work directly to master).

**Key references (read before coding):**
- `components/ProjectionFlipCard.tsx` — the flip card being generalized into `CardTile`.
- `components/ProjectionChart.tsx`, `components/ProjectionManaBar.tsx` — consumed by the back face (unchanged).
- `components/ProjectionPanel.tsx` — existing lazy projection+price fetch pattern (model for `loadOnFlip`).
- `__tests__/components.test.tsx` — the component-test pattern to follow (`render`/`screen`/`fireEvent`, `container.querySelector`).
- `app/api/hot/route.ts`, `lib/mtggoldfish.ts` (`getMTGGoldfishMovers`), `lib/supabase-signals.ts` (`fetchSignals`) — data sources.

**Design tokens already in the codebase** (Tailwind `tailwind.config.ts`): `bg-primary #0a0a0f`, `bg-card #16161f`, `bg-elevated #1c1c28`, `bg-border #2a2a3a`, `gold #d4a843`, `gold-light #e8c062`, `bull #22c55e`, `bear #ef4444`, `neutral #94a3b8`; fonts `font-display` (Playfair/Georgia), `font-mono` (JetBrains Mono).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/design-tokens.ts` (create) | Named motion durations + easings shared by components |
| `app/globals.css` (modify) | Add motion-system CSS (nebula drift, foil sheen, gold trace, opening-hand stagger, top-card ping) + one `prefers-reduced-motion` gate |
| `components/SectionLabel.tsx` (create) | Gold uppercase mono label with trailing fade-rule |
| `components/NavTile.tsx` (create) | Art-backed navigation tile with gold-hairline-trace hover |
| `components/MoversTicker.tsx` (create) | Single-row marquee of gainers/losers |
| `components/ManaNebula.tsx` (create) | Three drifting radial-gradient blobs (landing background) |
| `components/CardTile.tsx` (create) | Universal flip card: front art + price/verdict, back chart; generalized from ProjectionFlipCard |
| `components/ProjectionFlipCard.tsx` (replace body) | Thin wrapper mapping `WatchlistEntry` → `CardTile` (keeps watchlist + ProjectionPanel working) |
| `lib/hot-cards.ts` (create) | `getHotCards()` extracted from the hot route; route imports it |
| `app/api/hot/route.ts` (modify) | Import `getHotCards` instead of inlining aggregation |
| `lib/landing.ts` (create) | `getLandingData()` — nav counts + priced hot/mover cards + ticker rows |
| `components/LandingClient.tsx` (create) | Client shell: renders the four sections, owns once-per-session Opening Hand + Top Card |
| `app/page.tsx` (replace) | Server Component: fetch `getLandingData()`, render `<ManaNebula>` + `<LandingClient>` |
| `components/NavBar.tsx` (modify) | Slim restyle; bottom tab bar for the four destinations |
| `__tests__/ui-overhaul.test.tsx` (create) | Render tests for all new components |

---

## Task 1: Branch, design tokens, and motion CSS

**Files:**
- Create: `lib/design-tokens.ts`
- Modify: `app/globals.css` (append motion block)

- [ ] **Step 1: Create the feature branch**

```bash
cd "/Users/drdoom/Library/CloudStorage/OneDrive-Personal/Coding Projects/mtg-intel"
git checkout master && git pull
git checkout -b feat/ui-overhaul-phase-a
```

- [ ] **Step 2: Create the motion token module**

Create `lib/design-tokens.ts`:

```ts
// Shared motion constants so components and CSS stay in lockstep.
// Durations in ms. Easings match the keyframes in globals.css.
export const MOTION = {
  ease: {
    soft: "cubic-bezier(0.16, 1, 0.3, 1)",  // entrances
    foil: "cubic-bezier(0.22, 1, 0.36, 1)", // foil sweep
    flip: "cubic-bezier(0.4, 0.2, 0.2, 1)", // card flip
  },
  dur: {
    fast: 200,
    lift: 250,
    rise: 450,
    foil: 650,
    flip: 550,
    ping: 900,
  },
} as const;

// sessionStorage key gating the once-per-session landing motion.
export const LANDING_SEEN_KEY = "mtgintel_landing_seen";
```

- [ ] **Step 3: Append the motion-system CSS**

Append to `app/globals.css`:

```css
/* ───────────────────────── Motion System (Phase A) ───────────────────────── */

/* Tier 1 — Mana Nebula (ambient). GPU transforms only. */
.nebula-blob { position: absolute; border-radius: 50%; pointer-events: none; will-change: transform; }
.nebula-a { width: 1200px; height: 1200px; left: -400px; top: -700px;
  background: radial-gradient(circle, rgba(26,36,64,0.5) 0%, transparent 60%);
  animation: nebDriftA 90s linear infinite alternate; }
.nebula-b { width: 1000px; height: 1000px; right: -350px; bottom: -600px;
  background: radial-gradient(circle, rgba(42,31,61,0.45) 0%, transparent 60%);
  animation: nebDriftB 120s linear infinite alternate; }
.nebula-c { width: 900px; height: 900px; left: 30%; top: -500px;
  background: radial-gradient(circle, rgba(212,168,67,0.04) 0%, transparent 55%);
  animation: nebDriftC 150s linear infinite alternate; }
@keyframes nebDriftA { from { transform: translate(0,0); } to { transform: translate(60px,30px); } }
@keyframes nebDriftB { from { transform: translate(0,0); } to { transform: translate(-50px,-25px); } }
@keyframes nebDriftC { from { transform: translate(0,0); } to { transform: translate(40px,20px); } }

/* Tier 2 — Foil Sheen (one-shot on card hover). */
.foil-sheen { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge;
  opacity: 0; border-radius: inherit;
  background: linear-gradient(115deg, transparent 30%, rgba(212,168,67,0.25) 45%,
    rgba(160,190,255,0.18) 50%, rgba(255,160,200,0.15) 55%, transparent 70%);
  background-size: 300% 100%; background-position: 120% 0; }
.foil-host:hover .foil-sheen { animation: foilSweepOnce 0.65s cubic-bezier(0.22,1,0.36,1) forwards; }
@keyframes foilSweepOnce {
  0% { opacity: 1; background-position: 120% 0; }
  100% { opacity: 0; background-position: -60% 0; } }

/* Tier 2 — Gold Hairline Trace (nav tile hover). SVG rect uses pathLength=100. */
.navtile-trace { fill: none; stroke: #d4a843; stroke-width: 1.5; opacity: 0;
  stroke-dasharray: 100; stroke-dashoffset: 100; }
.navtile-host:hover .navtile-trace { animation: traceBorder 0.5s ease-out forwards; }
@keyframes traceBorder {
  0% { stroke-dashoffset: 100; opacity: 0.9; }
  100% { stroke-dashoffset: 0; opacity: 0.5; } }

/* Tier 3 — Opening Hand (entrance stagger; activated by .is-dealing on a parent). */
.deal { opacity: 0; transform: translateY(14px); }
.is-dealing .deal { animation: dealRise 0.45s cubic-bezier(0.16,1,0.3,1) forwards; }
.is-settled .deal { opacity: 1; transform: none; }
@keyframes dealRise { to { opacity: 1; transform: translateY(0); } }
.is-dealing .deal-1 { animation-delay: 0ms; }
.is-dealing .deal-2 { animation-delay: 90ms; }
.is-dealing .deal-3 { animation-delay: 180ms; }
.is-dealing .deal-4 { animation-delay: 270ms; }
.is-dealing .deal-g1 { animation-delay: 220ms; }
.is-dealing .deal-g2 { animation-delay: 260ms; }
.is-dealing .deal-g3 { animation-delay: 300ms; }
.is-dealing .deal-g4 { animation-delay: 340ms; }
.is-dealing .deal-g5 { animation-delay: 380ms; }

/* Tier 3 — Top Card sonar ping (one ring off the lead tile's ribbon). */
.topcard-ping { position: absolute; top: 7px; left: 7px; width: 36px; height: 16px;
  border: 1px solid #4ade80; border-radius: 3px; opacity: 0; pointer-events: none; z-index: 2; }
.topcard-signature .topcard-ping { animation: sonarPing 0.9s ease-out 0.2s 1; }
@keyframes sonarPing {
  0% { opacity: 0.5; transform: scale(1); }
  100% { opacity: 0; transform: scale(2.4); } }
.topcard-signature .foil-sheen { animation: foilSweepOnce 0.65s cubic-bezier(0.22,1,0.36,1) 0.2s 1; }

/* One gate disables every Phase A motion. Page must be complete without it. */
@media (prefers-reduced-motion: reduce) {
  .nebula-a, .nebula-b, .nebula-c,
  .foil-host:hover .foil-sheen, .navtile-host:hover .navtile-trace,
  .is-dealing .deal, .topcard-signature .topcard-ping,
  .topcard-signature .foil-sheen { animation: none !important; }
  .deal { opacity: 1 !important; transform: none !important; }
}
```

- [ ] **Step 4: Verify the build compiles**

Run: `npm run build`
Expected: `✓ Compiled successfully` (CSS-only + a const module; no type errors).

- [ ] **Step 5: Commit**

```bash
git add lib/design-tokens.ts app/globals.css
git commit -m "feat: add Phase A motion tokens and motion-system CSS"
```

---

## Task 2: SectionLabel component

**Files:**
- Create: `components/SectionLabel.tsx`
- Test: `__tests__/ui-overhaul.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/ui-overhaul.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SectionLabel from "@/components/SectionLabel";

describe("SectionLabel", () => {
  it("renders its text content", () => {
    render(<SectionLabel>Hot right now</SectionLabel>);
    expect(screen.getByText("Hot right now")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/SectionLabel'`.

- [ ] **Step 3: Implement the component**

Create `components/SectionLabel.tsx`:

```tsx
export default function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-gold">
        {children}
      </span>
      <span
        className="flex-1 h-px"
        style={{ background: "linear-gradient(90deg, #d4a84333, transparent)" }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add components/SectionLabel.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add SectionLabel component"
```

---

## Task 3: NavTile component

**Files:**
- Create: `components/NavTile.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import NavTile from "@/components/NavTile";

describe("NavTile", () => {
  it("renders label, count, and links to href", () => {
    const { container } = render(
      <NavTile href="/market" label="Market" count="19 movers" artName="Smothering Tithe" />
    );
    expect(screen.getByText("Market")).toBeTruthy();
    expect(screen.getByText("19 movers")).toBeTruthy();
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/market");
  });

  it("omits the count node when count is absent", () => {
    render(<NavTile href="/hot" label="Hot" artName="Lightning Bolt" />);
    expect(screen.queryByText(/movers/)).toBeNull();
  });

  it("renders the gold-trace SVG overlay", () => {
    const { container } = render(
      <NavTile href="/intel" label="Intel" artName="Rhystic Study" />
    );
    expect(container.querySelector("svg .navtile-trace")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/NavTile'`.

- [ ] **Step 3: Implement the component**

Create `components/NavTile.tsx`. The Scryfall `art_crop` is loaded by name; `<img>` with eslint-disable matches the existing ProjectionFlipCard pattern.

```tsx
import Link from "next/link";

interface Props {
  href: string;
  label: string;
  artName: string;       // card name whose art_crop backs the tile
  count?: string;        // e.g. "19 movers"
}

function artUrl(name: string): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=art_crop`;
}

export default function NavTile({ href, label, artName, count }: Props) {
  return (
    <Link
      href={href}
      className="navtile-host relative block h-24 rounded-xl overflow-hidden border border-bg-border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={artUrl(artName)}
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover opacity-[0.28] transition-opacity duration-300 group-hover:opacity-50"
      />
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, transparent 30%, rgba(5,5,8,0.92))" }}
      />
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <rect className="navtile-trace" x="1" y="1" width="98%" height="93%" rx="11" pathLength={100} />
      </svg>
      <span className="absolute left-3 bottom-2.5 font-display font-bold text-[13px] tracking-[0.14em] text-[#a0a0b0]">
        {label}
      </span>
      {count && (
        <span className="absolute right-2.5 bottom-2.5 font-mono text-[10px] text-gold/70">
          {count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: PASS (SectionLabel + 3 NavTile tests).

- [ ] **Step 5: Commit**

```bash
git add components/NavTile.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add NavTile component with gold-hairline-trace hover"
```

---

## Task 4: MoversTicker component

**Files:**
- Create: `components/MoversTicker.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import MoversTicker from "@/components/MoversTicker";
import type { MTGStocksInterest } from "@/types";

const mover = (name: string, percent: number): MTGStocksInterest => ({
  name, id: 1, print_id: 1, percent, avg: 10, new_price: 10, old_price: 9, set_name: "TST",
});

describe("MoversTicker", () => {
  it("renders each mover name and signed percent", () => {
    render(<MoversTicker movers={[mover("Mox Ruby", 50), mover("Juzam Djinn", -18)]} />);
    expect(screen.getAllByText("Mox Ruby").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\+50%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-18%/).length).toBeGreaterThan(0);
  });

  it("renders an empty-state message when there are no movers", () => {
    render(<MoversTicker movers={[]} />);
    expect(screen.getByText(/No market movers/i)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/MoversTicker'`.

- [ ] **Step 3: Implement the component**

Create `components/MoversTicker.tsx`. CSS-only constant-velocity marquee (content duplicated for a seamless loop; hover-decelerate physics is Phase B). The marquee keyframe is component-scoped via a `<style jsx global>`-free inline `<style>` tag to avoid touching globals further.

```tsx
import type { MTGStocksInterest } from "@/types";

export default function MoversTicker({ movers }: { movers: MTGStocksInterest[] }) {
  if (movers.length === 0) {
    return (
      <div className="rounded-xl border border-bg-border bg-[#101018] px-4 py-2.5 font-mono text-[11px] text-neutral italic">
        No market movers right now.
      </div>
    );
  }

  const row = movers.map((m) => {
    const up = m.percent >= 0;
    return (
      <span key={`${m.name}-${m.id}`} className="inline-flex items-center gap-1.5 mr-7">
        <span className="text-neutral">{up ? "↗" : "↘"}</span>
        <span className="text-[#e6edf3]">{m.name}</span>
        <span style={{ color: up ? "#4ade80" : "#f87171" }}>
          {up ? "+" : ""}{m.percent}%
        </span>
      </span>
    );
  });

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-bg-border bg-[#101018] py-2.5 font-mono text-[11px]"
      style={{ maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
               WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)" }}
    >
      <style>{`
        @keyframes tickerScroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .ticker-track { display: inline-flex; white-space: nowrap; animation: tickerScroll 40s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ticker-track { animation: none; } }
      `}</style>
      <div className="ticker-track">
        <span className="inline-flex">{row}</span>
        <span className="inline-flex" aria-hidden="true">{row}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: PASS. (Names appear twice because the track is duplicated — the test uses `getAllByText`.)

- [ ] **Step 5: Commit**

```bash
git add components/MoversTicker.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add MoversTicker marquee component"
```

---

## Task 5: ManaNebula component

**Files:**
- Create: `components/ManaNebula.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import ManaNebula from "@/components/ManaNebula";

describe("ManaNebula", () => {
  it("renders three drifting blobs behind content", () => {
    const { container } = render(<ManaNebula />);
    expect(container.querySelector(".nebula-a")).toBeTruthy();
    expect(container.querySelector(".nebula-b")).toBeTruthy();
    expect(container.querySelector(".nebula-c")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/ManaNebula'`.

- [ ] **Step 3: Implement the component**

Create `components/ManaNebula.tsx`:

```tsx
// Ambient drifting mana light. Fixed behind landing content; classes + keyframes
// live in globals.css and are disabled by prefers-reduced-motion.
export default function ManaNebula() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <div className="nebula-blob nebula-a" />
      <div className="nebula-blob nebula-b" />
      <div className="nebula-blob nebula-c" />
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ManaNebula.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add ManaNebula ambient background component"
```

---

## Task 6: CardTile (generalize ProjectionFlipCard) + thin re-export

**Files:**
- Create: `components/CardTile.tsx`
- Replace body: `components/ProjectionFlipCard.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

This task moves the existing flip-card markup into `CardTile` with a flatter, general prop set and adds the price/delta front badge + foil sheen. `loadOnFlip` is added in Task 7. `ProjectionFlipCard` becomes a wrapper so `app/watchlist/page.tsx` and `components/ProjectionPanel.tsx` keep working unchanged.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import { fireEvent } from "@testing-library/react";
import CardTile from "@/components/CardTile";
import type { Projection, PricePoint } from "@/types";

const projection: Projection = {
  id: "p1", card_name: "Ragavan, Nimble Pilferer", verdict: "BUY", confidence: 0.84,
  reasoning: "Bullish momentum.", flavor_text: null,
  key_signals: ["Bullish"], signal_pips: ["sentiment"], algorithm_json: null,
  source: "algorithm", purpose_key: "x", cached_at: "", expires_at: "",
  outcome_price_validated: false, outcome_signal_validated: false,
  outcome_user_validated: false, outcome_score: null, validated_at: null,
};
const history: PricePoint[] = [
  { date: "2026-06-10", price: 48, source: "snapshot" },
  { date: "2026-06-11", price: 50, source: "snapshot" },
];

describe("CardTile", () => {
  it("renders the card name on the front", () => {
    render(<CardTile cardName="Ragavan, Nimble Pilferer" imageUri="/r.jpg" />);
    expect(screen.getByText("Ragavan, Nimble Pilferer")).toBeTruthy();
  });

  it("derives a Scryfall image URL when imageUri is absent", () => {
    const { container } = render(<CardTile cardName="Sol Ring" />);
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("api.scryfall.com/cards/named");
    expect(img?.getAttribute("src")).toContain("Sol+Ring");
  });

  it("shows a price + delta badge on the front when provided", () => {
    render(<CardTile cardName="Sol Ring" price={1.49} delta={4.2} />);
    expect(screen.getByText("$1.49")).toBeTruthy();
    expect(screen.getByText(/\+4.2%/)).toBeTruthy();
  });

  it("renders the verdict ribbon when a verdict is given", () => {
    render(<CardTile cardName="Sol Ring" verdict="SELL" />);
    expect(screen.getByText("SELL")).toBeTruthy();
  });

  it("flips to the chart back on click", () => {
    const { container } = render(
      <CardTile cardName="Ragavan, Nimble Pilferer" projection={projection} priceHistory={history} />
    );
    const scene = container.firstElementChild as HTMLElement;
    const inner = scene.firstElementChild as HTMLElement;
    expect(inner.style.transform).toContain("rotateY(0deg)");
    fireEvent.click(scene);
    expect(inner.style.transform).toContain("rotateY(180deg)");
  });

  it("renders a foil-sheen layer on the front", () => {
    const { container } = render(<CardTile cardName="Sol Ring" />);
    expect(container.querySelector(".foil-sheen")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/CardTile'`.

- [ ] **Step 3: Implement CardTile**

Create `components/CardTile.tsx`. This preserves the approved card-frame look of `ProjectionFlipCard` (matching `design-ui-flip.html`) and adds: flat props, Scryfall image fallback, front price/delta badge, `.foil-host`/`.foil-sheen`, and a `signature` flag for the Top Card moment.

```tsx
"use client";

import { useState } from "react";
import type { Projection, PricePoint, ProjectionVerdict } from "@/types";
import ProjectionChart from "@/components/ProjectionChart";
import ProjectionManaBar from "@/components/ProjectionManaBar";

const VERDICT_COLORS: Record<ProjectionVerdict, { frame: string; text: string; band: string; bg: string }> = {
  BUY:  { frame: "#22c55e", text: "#4ade80", band: "linear-gradient(90deg,#0d3d0d,#22c55e,#16a34a,#22c55e,#0d3d0d)", bg: "linear-gradient(170deg,#0d1f0d,#0f2510)" },
  HOLD: { frame: "#d4a843", text: "#d4a843", band: "linear-gradient(90deg,#5a3e00,#d4a843,#c8982a,#d4a843,#5a3e00)", bg: "linear-gradient(170deg,#1e1608,#251c09)" },
  SELL: { frame: "#ef4444", text: "#f87171", band: "linear-gradient(90deg,#5a0d0d,#ef4444,#dc2626,#ef4444,#5a0d0d)", bg: "linear-gradient(170deg,#1f0d0d,#250f0f)" },
};

function rarity(score: number): { color: string; symbol: string } {
  if (score >= 8) return { color: "#ff8c00", symbol: "⬟" };
  if (score >= 6) return { color: "#d4a843", symbol: "⬟" };
  return { color: "#a8b8c8", symbol: "⬟" };
}

export function scryfallImage(name: string, version: "normal" | "art_crop" = "normal"): string {
  return `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(name)}&format=image&version=${version}`;
}

export interface CardTileProps {
  cardName: string;
  imageUri?: string;
  setCode?: string;
  collectorNumber?: string;
  typeLine?: string;
  finish?: string;
  price?: number | null;
  delta?: number | null;
  verdict?: ProjectionVerdict;
  projection?: Projection | null;
  priceHistory?: PricePoint[];
  showBack?: boolean;
  signature?: boolean;     // Top Card once-per-session moment (foil sweep + ping)
  size?: "sm" | "md";
}

export default function CardTile({
  cardName, imageUri, setCode, collectorNumber, typeLine, finish,
  price, delta, verdict: verdictProp, projection = null, priceHistory = [],
  showBack = false, signature = false, size = "md",
}: CardTileProps) {
  const [flipped, setFlipped] = useState(showBack);

  const cardWidth = size === "sm" ? 180 : 220;
  const cardHeight = size === "sm" ? 270 : 330;
  const chartHeight = size === "sm" ? 84 : 105;

  const verdict: ProjectionVerdict = projection?.verdict ?? verdictProp ?? "HOLD";
  const vc = VERDICT_COLORS[verdict];
  const showRibbon = !!projection || !!verdictProp;
  const rar = rarity(projection ? projection.confidence * 10 : 5);
  const type = typeLine ?? setCode ?? "";
  const img = imageUri || scryfallImage(cardName, "normal");
  const nameFontSize = cardWidth < 200 ? 9.5 : 11.5;
  const textFontSize = cardWidth < 200 ? 8 : 9;

  const deltaUp = (delta ?? 0) >= 0;

  return (
    <div
      className={`foil-host${signature ? " topcard-signature" : ""}`}
      style={{ width: cardWidth, height: cardHeight, perspective: 900, cursor: "pointer", flexShrink: 0 }}
      onClick={() => !showBack && setFlipped((f) => !f)}
    >
      <div
        style={{
          width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4,0.2,0.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          borderRadius: 14, boxShadow: "0 0 0 3px #0a0a0a, 0 20px 60px rgba(0,0,0,0.85)",
        }}
      >
        {/* ── FRONT ── */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          borderRadius: 14, overflow: "hidden", background: vc.bg, display: "flex", flexDirection: "column",
          fontFamily: "Georgia,'Times New Roman',serif" }}>
          <div style={{ height: 7, background: vc.band }} />
          <div style={{ padding: "5px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: nameFontSize, fontWeight: 700, color: vc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: cardWidth - 50 }}>{cardName}</div>
            <span style={{ fontSize: 11, fontWeight: 700, color: rar.color }}>{rar.symbol}</span>
          </div>
          <div style={{ flex: 1, margin: "5px 8px", borderRadius: 3, overflow: "hidden", border: "2px solid #0a0a0a", position: "relative" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img} alt={cardName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {showRibbon && (
              <div style={{ position: "absolute", top: 6, left: 7, background: `${vc.frame}14`, border: `1px solid ${vc.frame}50`, color: vc.text, borderRadius: 3, padding: "2px 6px", fontSize: 8, fontFamily: "monospace", fontWeight: 700 }}>{verdict}</div>
            )}
            <span className="topcard-ping" />
            <div style={{ position: "absolute", top: 6, right: 7, background: "rgba(0,0,0,0.65)", color: `${vc.text}b0`, borderRadius: 3, padding: "2px 5px", fontSize: 7, fontFamily: "monospace" }}>↺ chart</div>
            {price != null && (
              <div style={{ position: "absolute", bottom: 6, right: 7, background: "rgba(0,0,0,0.8)", borderRadius: 4, padding: "2px 7px", display: "flex", gap: 5, alignItems: "center", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e6edf3" }}>${price.toFixed(2)}</span>
                {delta != null && (
                  <span style={{ fontFamily: "monospace", fontSize: 9, color: deltaUp ? "#4ade80" : "#f87171" }}>{deltaUp ? "+" : ""}{delta}%</span>
                )}
              </div>
            )}
            <div className="foil-sheen" />
          </div>
          <div style={{ margin: "0 8px 4px", padding: "2px 6px", background: "rgba(0,0,0,0.4)", border: `1px solid ${vc.frame}30`, borderRadius: 2, fontSize: 8, color: `${vc.text}80`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{type}</span>
          </div>
          <div style={{ padding: "3px 10px 7px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(0,0,0,0.4)", fontSize: 7, fontFamily: "monospace", color: `${vc.frame}80` }}>
            <span>{setCode ? `${setCode.toUpperCase()}${collectorNumber ? ` #${collectorNumber}` : ""}${finish ? ` · ${finish}` : ""}` : ""}</span>
            <span>{projection ? `${Math.round(projection.confidence * 100)}% conf` : ""}</span>
          </div>
        </div>

        {/* ── BACK (chart) ── */}
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)", borderRadius: 14, overflow: "hidden", background: vc.bg,
          display: "flex", flexDirection: "column", fontFamily: "Georgia,'Times New Roman',serif" }}>
          <div style={{ height: 7, background: vc.band }} />
          <div style={{ padding: "5px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#c9922a" }}>Market Projection</div>
            {projection && <ProjectionManaBar pips={projection.signal_pips} />}
          </div>
          <div style={{ margin: "5px 8px", borderRadius: 3, overflow: "hidden", border: "2px solid #0a0a0a" }}>
            <ProjectionChart history={priceHistory} verdict={verdict} width={cardWidth - 20} height={chartHeight} />
          </div>
          <div style={{ margin: "0 8px 5px", padding: "8px 9px", flex: 1, background: "rgba(0,0,0,0.3)", border: `2px solid ${vc.frame}30`, borderRadius: 3, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            {projection ? (
              <>
                <div style={{ fontSize: textFontSize, fontWeight: 700, color: "#e6edf3", lineHeight: 1.4 }}>{projection.key_signals.join(" · ")}</div>
                <div style={{ fontSize: textFontSize - 0.5, color: "#c9d1d9", lineHeight: 1.6, marginTop: 4 }}>{projection.reasoning}</div>
              </>
            ) : priceHistory.length > 0 ? (
              <div style={{ fontSize: textFontSize, color: "#c9d1d9", lineHeight: 1.5 }}>Price history over the last {priceHistory.length} day(s).</div>
            ) : (
              <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textAlign: "center" }}>No projection yet.</div>
            )}
          </div>
          <div style={{ padding: "3px 10px 7px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 6.5, fontFamily: "monospace", color: `${vc.frame}70`, lineHeight: 1.5 }}>{projection ? (projection.source === "algorithm" ? "⚙ algo" : "Claude") : ""}</div>
            <div style={{ fontFamily: "Georgia,serif", fontWeight: 700, fontSize: 13, border: "2px solid #0a0a0a", borderRadius: 4, padding: "2px 7px",
              background: verdict === "BUY" ? "linear-gradient(135deg,#1a4a1a,#0d2e0d)" : verdict === "SELL" ? "linear-gradient(135deg,#7a1a1a,#4a0d0d)" : "linear-gradient(135deg,#7a5500,#4a3300)",
              color: vc.text }}>{projection ? `${Math.round(projection.confidence * 100)}%` : "—"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace `ProjectionFlipCard` with a thin wrapper**

Replace the entire contents of `components/ProjectionFlipCard.tsx`:

```tsx
"use client";

import type { WatchlistEntry, Projection, PricePoint } from "@/types";
import CardTile from "@/components/CardTile";

interface Props {
  entry: WatchlistEntry;
  projection: Projection | null;
  priceHistory: PricePoint[];
  showBack?: boolean;
  size?: "sm" | "md";
}

// Back-compat wrapper: watchlist + ProjectionPanel pass a WatchlistEntry.
export default function ProjectionFlipCard({ entry, projection, priceHistory, showBack = false, size = "md" }: Props) {
  return (
    <CardTile
      cardName={entry.card_name}
      imageUri={entry.image_uri}
      setCode={entry.set_code}
      collectorNumber={entry.collector_number}
      typeLine={entry.type_line ?? entry.set_name}
      finish={entry.finish}
      projection={projection}
      priceHistory={priceHistory}
      showBack={showBack}
      size={size}
    />
  );
}
```

- [ ] **Step 5: Run tests + build to verify nothing broke**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx && npm run build`
Expected: PASS (all CardTile tests) and `✓ Compiled successfully`. Existing watchlist/ProjectionPanel imports still resolve.

- [ ] **Step 6: Commit**

```bash
git add components/CardTile.tsx components/ProjectionFlipCard.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: generalize ProjectionFlipCard into universal CardTile + thin re-export"
```

---

## Task 7: CardTile lazy detail (`loadOnFlip`)

**Files:**
- Modify: `components/CardTile.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

Landing tiles have no projection/history at render time. With `loadOnFlip`, the first flip fetches `/api/projections/[cardName]` and `/api/prices?name=` (mirroring `ProjectionPanel`) and populates the back.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import { waitFor } from "@testing-library/react";

describe("CardTile loadOnFlip", () => {
  it("fetches projection and price on first flip", async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("/api/projections/")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(projection) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ history }) });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const { container } = render(<CardTile cardName="Ragavan, Nimble Pilferer" loadOnFlip />);
    fireEvent.click(container.firstElementChild as HTMLElement);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/projections/"));
      expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/prices?name="));
    });
    vi.unstubAllGlobals();
  });

  it("does not fetch when projection is already provided", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);
    const { container } = render(
      <CardTile cardName="Sol Ring" loadOnFlip projection={projection} priceHistory={history} />
    );
    fireEvent.click(container.firstElementChild as HTMLElement);
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
```

Add `vi` and `waitFor` to the existing imports at the top of the file if not present: `import { describe, it, expect, vi } from "vitest";` and `import { render, screen, fireEvent, waitFor } from "@testing-library/react";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `loadOnFlip` does nothing yet, so the fetch assertions fail.

- [ ] **Step 3: Implement `loadOnFlip`**

In `components/CardTile.tsx`, add `loadOnFlip?: boolean` to `CardTileProps`, destructure it (default `false`), and add lazy state + fetch. Replace the `useState(showBack)` line and the `onClick` handler region with:

```tsx
  const [flipped, setFlipped] = useState(showBack);
  const [lazyProjection, setLazyProjection] = useState<Projection | null>(null);
  const [lazyHistory, setLazyHistory] = useState<PricePoint[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function ensureLoaded() {
    if (loaded || projection || !loadOnFlip) return;
    setLoaded(true);
    try {
      const [projRes, priceRes] = await Promise.all([
        fetch(`/api/projections/${encodeURIComponent(cardName)}`),
        fetch(`/api/prices?name=${encodeURIComponent(cardName)}`),
      ]);
      if (projRes.ok) setLazyProjection(await projRes.json());
      if (priceRes.ok) {
        const data = await priceRes.json();
        setLazyHistory(data?.history ?? []);
      }
    } catch {
      /* leave back in its no-projection state */
    }
  }

  function handleClick() {
    if (showBack) return;
    if (!flipped) void ensureLoaded();
    setFlipped((f) => !f);
  }
```

Change the root `onClick={() => !showBack && setFlipped((f) => !f)}` to `onClick={handleClick}`. Then make the render use the lazy values as fallbacks — update the derived lines:

```tsx
  const effectiveProjection = projection ?? lazyProjection;
  const effectiveHistory = priceHistory.length ? priceHistory : lazyHistory;
```

and replace later uses of `projection` with `effectiveProjection` and `priceHistory` with `effectiveHistory` in the back face (verdict, ProjectionManaBar, ProjectionChart, reasoning, footer, P/T box). The front face keeps using `projection`/`verdictProp` for the ribbon so the front does not change on flip.

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx && npm run build`
Expected: PASS (both new tests) and a clean build.

- [ ] **Step 5: Commit**

```bash
git add components/CardTile.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add loadOnFlip lazy projection/price fetch to CardTile"
```

---

## Task 8: Extract `getHotCards` into a lib

**Files:**
- Create: `lib/hot-cards.ts`
- Modify: `app/api/hot/route.ts`
- Test: `__tests__/hot-cards.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/hot-cards.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { IntelSignal } from "@/types";

const sig = (name: string, sentiment: "bullish" | "bearish", strength = 6): IntelSignal => ({
  id: name + sentiment, card_name_raw: name, source_type: "reddit",
  source_url: "x", source_title: "t", sentiment, signal_strength: strength,
  summary: "s", published_at: new Date().toISOString(),
});

describe("getHotCards", () => {
  it("splits buy and sell cards aggregated by name", async () => {
    vi.doMock("@/lib/supabase-signals", () => ({
      fetchSignals: vi.fn().mockResolvedValue([
        sig("Sol Ring", "bullish"), sig("Sol Ring", "bullish"),
        sig("Aura Shards", "bearish"),
      ]),
    }));
    const { getHotCards } = await import("@/lib/hot-cards");
    const { buy, sell } = await getHotCards();

    expect(buy.find((c) => c.card_name === "Sol Ring")?.signal_count).toBe(2);
    expect(sell.find((c) => c.card_name === "Aura Shards")).toBeTruthy();
    vi.resetModules();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/hot-cards.test.ts`
Expected: FAIL — `Cannot find module '@/lib/hot-cards'`.

- [ ] **Step 3: Create `lib/hot-cards.ts`**

Move the `HotCard` interface and `isBuy`/`isSell`/`aggregate`/sorting logic out of `app/api/hot/route.ts` verbatim into a new lib, wrapped in `getHotCards()`:

```ts
import { fetchSignals } from "@/lib/supabase-signals";
import type { IntelSignal, SignalType } from "@/types";

const SELL_TYPES: SignalType[] = ["reprint_announced", "price_peak", "ban_risk", "set_release_pressure"];
const BUY_TYPES: SignalType[] = ["buy_hype", "format_staple"];

export interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

function isSell(s: IntelSignal): boolean {
  return s.sentiment === "bearish" || (s.signal_type != null && SELL_TYPES.includes(s.signal_type));
}
function isBuy(s: IntelSignal): boolean {
  return s.sentiment === "bullish" || (s.signal_type != null && BUY_TYPES.includes(s.signal_type));
}

function aggregate(signals: IntelSignal[]): HotCard[] {
  const map = new Map<string, IntelSignal[]>();
  for (const s of signals) {
    const key = s.card_name_raw.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()].map(([, group]) => {
    const sorted = [...group].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
    const windows = group.map((s) => s.sell_window).filter((w): w is string => !!w).sort();
    return {
      card_name: sorted[0].card_name_raw,
      signal_count: group.length,
      signal_type: sorted[0].signal_type ?? "general",
      avg_strength: Math.round((group.reduce((s, g) => s + g.signal_strength, 0) / group.length) * 10) / 10,
      latest_signal: sorted[0].published_at,
      sell_window: windows[0] ?? null,
      summaries: [...new Set(group.map((s) => s.summary))].slice(0, 3),
    };
  });
}

export async function getHotCards(): Promise<{ buy: HotCard[]; sell: HotCard[] }> {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const signals = await fetchSignals({ after: since.toISOString() });

  const buy = aggregate(signals.filter(isBuy)).sort((a, b) => b.signal_count - a.signal_count);
  const sell = aggregate(signals.filter(isSell)).sort((a, b) => {
    if (a.sell_window && b.sell_window) return a.sell_window.localeCompare(b.sell_window);
    if (a.sell_window) return -1;
    if (b.sell_window) return 1;
    return b.signal_count - a.signal_count;
  });
  return { buy, sell };
}
```

- [ ] **Step 4: Simplify the route to use it**

Replace the entire contents of `app/api/hot/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getHotCards } from "@/lib/hot-cards";

export async function GET() {
  try {
    return NextResponse.json(await getHotCards());
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run tests + build**

Run: `npx vitest run __tests__/hot-cards.test.ts && npm run build`
Expected: PASS and clean build.

- [ ] **Step 6: Commit**

```bash
git add lib/hot-cards.ts app/api/hot/route.ts __tests__/hot-cards.test.ts
git commit -m "refactor: extract getHotCards into lib/hot-cards reused by route"
```

---

## Task 9: `getLandingData` — priced cards + nav counts

**Files:**
- Create: `lib/landing.ts`
- Test: `__tests__/landing.test.ts`

Reality check that overrides the spec's wording: `/api/hot` cards carry no price, but `getMTGGoldfishMovers()` returns name + `new_price` + `percent`. So the priced "Hot right now" grid is built from movers, with BUY/SELL verdicts overlaid from hot signal name-matches. If movers is empty, fall back to hot cards (no price). This honors the spec's intent (card-first, prices visible) with the data we actually have.

- [ ] **Step 1: Write the failing test**

Create `__tests__/landing.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";
import type { MTGStocksInterest } from "@/types";

const mover = (name: string, percent: number, price: number): MTGStocksInterest => ({
  name, id: 1, print_id: 1, percent, avg: price, new_price: price, old_price: price - 1, set_name: "TST",
});

describe("getLandingData", () => {
  it("builds priced cards from movers and overlays hot verdicts", async () => {
    vi.doMock("@/lib/mtggoldfish", () => ({
      getMTGGoldfishMovers: vi.fn().mockResolvedValue({
        average: [mover("Sol Ring", 5, 1.49), mover("Aura Shards", -3, 28.2)], foil: [],
      }),
    }));
    vi.doMock("@/lib/hot-cards", () => ({
      getHotCards: vi.fn().mockResolvedValue({
        buy: [{ card_name: "Sol Ring", signal_count: 2 }],
        sell: [{ card_name: "Aura Shards", signal_count: 1 }],
      }),
    }));
    vi.doMock("@/lib/supabase-signals", () => ({
      fetchSignals: vi.fn().mockResolvedValue([{}, {}, {}]),
    }));

    const { getLandingData } = await import("@/lib/landing");
    const data = await getLandingData();

    const solRing = data.cards.find((c) => c.card_name === "Sol Ring");
    expect(solRing?.price).toBe(1.49);
    expect(solRing?.verdict).toBe("BUY");
    expect(data.cards.find((c) => c.card_name === "Aura Shards")?.verdict).toBe("SELL");
    expect(data.navCounts.market).toBe(2);
    expect(data.navCounts.intel).toBe(3);
    vi.resetModules();
  });

  it("returns empty cards and zero counts when sources fail", async () => {
    vi.doMock("@/lib/mtggoldfish", () => ({ getMTGGoldfishMovers: vi.fn().mockRejectedValue(new Error("x")) }));
    vi.doMock("@/lib/hot-cards", () => ({ getHotCards: vi.fn().mockRejectedValue(new Error("x")) }));
    vi.doMock("@/lib/supabase-signals", () => ({ fetchSignals: vi.fn().mockRejectedValue(new Error("x")) }));

    const { getLandingData } = await import("@/lib/landing");
    const data = await getLandingData();

    expect(data.cards).toEqual([]);
    expect(data.movers).toEqual([]);
    expect(data.navCounts).toEqual({ market: 0, hot: 0, intel: 0 });
    vi.resetModules();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/landing.test.ts`
Expected: FAIL — `Cannot find module '@/lib/landing'`.

- [ ] **Step 3: Implement `lib/landing.ts`**

```ts
import { getMTGGoldfishMovers } from "@/lib/mtggoldfish";
import { getHotCards } from "@/lib/hot-cards";
import { fetchSignals } from "@/lib/supabase-signals";
import type { MTGStocksInterest, ProjectionVerdict } from "@/types";

export interface LandingCard {
  card_name: string;
  price: number | null;
  delta: number | null;
  verdict: ProjectionVerdict | null;
}

export interface LandingData {
  navCounts: { market: number; hot: number; intel: number };
  cards: LandingCard[];
  movers: MTGStocksInterest[];
}

const GRID_SIZE = 10;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> {
  try { return await p; } catch { return fallback; }
}

export async function getLandingData(): Promise<LandingData> {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const [moversResp, hot, signals] = await Promise.all([
    safe(getMTGGoldfishMovers(), { average: [], foil: [] }),
    safe(getHotCards(), { buy: [], sell: [] }),
    safe(fetchSignals({ after: since.toISOString() }), [] as unknown[]),
  ]);

  const buyNames = new Set(hot.buy.map((c) => c.card_name.toLowerCase()));
  const sellNames = new Set(hot.sell.map((c) => c.card_name.toLowerCase()));
  const verdictFor = (name: string): ProjectionVerdict | null => {
    const k = name.toLowerCase();
    if (sellNames.has(k)) return "SELL";
    if (buyNames.has(k)) return "BUY";
    return null;
  };

  let cards: LandingCard[];
  if (moversResp.average.length > 0) {
    cards = moversResp.average.slice(0, GRID_SIZE).map((m) => ({
      card_name: m.name, price: m.new_price, delta: m.percent, verdict: verdictFor(m.name),
    }));
  } else {
    // Fallback: hot cards (no price) when movers are unavailable.
    cards = [...hot.buy.map((c) => ({ v: "BUY" as const, c })), ...hot.sell.map((c) => ({ v: "SELL" as const, c }))]
      .slice(0, GRID_SIZE)
      .map(({ v, c }) => ({ card_name: c.card_name, price: null, delta: null, verdict: v }));
  }

  return {
    navCounts: {
      market: moversResp.average.length,
      hot: hot.buy.length + hot.sell.length,
      intel: signals.length,
    },
    cards,
    movers: moversResp.average,
  };
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run __tests__/landing.test.ts && npm run build`
Expected: PASS and clean build.

- [ ] **Step 5: Commit**

```bash
git add lib/landing.ts __tests__/landing.test.ts
git commit -m "feat: add getLandingData aggregating priced cards, verdicts, and nav counts"
```

---

## Task 10: LandingClient — sections + once-per-session motion

**Files:**
- Create: `components/LandingClient.tsx`
- Test: `__tests__/ui-overhaul.test.tsx` (append)

`LandingClient` is the client shell. It renders the four sections, reads `LANDING_SEEN_KEY` from sessionStorage once on mount to decide between the Opening Hand entrance (`is-dealing`) and a settled state (`is-settled`), and passes `signature` to the first card only on a first-of-session visit.

- [ ] **Step 1: Write the failing test**

Append to `__tests__/ui-overhaul.test.tsx`:

```tsx
import LandingClient from "@/components/LandingClient";
import type { LandingData } from "@/lib/landing";

const landingData: LandingData = {
  navCounts: { market: 19, hot: 4, intel: 21 },
  cards: [
    { card_name: "Ragavan, Nimble Pilferer", price: 50.46, delta: 4.2, verdict: "BUY" },
    { card_name: "Aura Shards", price: 28.2, delta: -2.8, verdict: "SELL" },
  ],
  movers: [
    { name: "Mox Ruby", id: 1, print_id: 1, percent: 50, avg: 1349, new_price: 1349, old_price: 1300, set_name: "CED" },
  ],
};

describe("LandingClient", () => {
  beforeEach(() => { window.sessionStorage.clear(); });

  it("renders all four nav tiles with counts", () => {
    render(<LandingClient data={landingData} />);
    expect(screen.getByText("MARKET")).toBeTruthy();
    expect(screen.getByText("HOT")).toBeTruthy();
    expect(screen.getByText("INTEL")).toBeTruthy();
    expect(screen.getByText("WATCHLIST")).toBeTruthy();
    expect(screen.getByText("19 movers")).toBeTruthy();
    expect(screen.getByText("21 signals")).toBeTruthy();
  });

  it("renders a card tile for each landing card", () => {
    render(<LandingClient data={landingData} />);
    expect(screen.getByText("Ragavan, Nimble Pilferer")).toBeTruthy();
    expect(screen.getByText("Aura Shards")).toBeTruthy();
  });

  it("marks the session as seen after first render", () => {
    render(<LandingClient data={landingData} />);
    expect(window.sessionStorage.getItem("mtgintel_landing_seen")).toBe("1");
  });

  it("renders the movers ticker", () => {
    render(<LandingClient data={landingData} />);
    expect(screen.getAllByText("Mox Ruby").length).toBeGreaterThan(0);
  });
});
```

This block uses `beforeEach` — ensure the vitest import at the top of the file reads `import { describe, it, expect, vi, beforeEach } from "vitest";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx`
Expected: FAIL — `Cannot find module '@/components/LandingClient'`.

- [ ] **Step 3: Implement `components/LandingClient.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import SearchBar from "@/components/SearchBar";
import NavTile from "@/components/NavTile";
import SectionLabel from "@/components/SectionLabel";
import CardTile from "@/components/CardTile";
import MoversTicker from "@/components/MoversTicker";
import { LANDING_SEEN_KEY } from "@/lib/design-tokens";
import type { LandingData } from "@/lib/landing";

const NAV = [
  { href: "/market",    label: "MARKET",    art: "Smothering Tithe", key: "market" as const, unit: "movers" },
  { href: "/hot",       label: "HOT",       art: "Lightning Bolt",   key: "hot" as const,    unit: "hot" },
  { href: "/intel",     label: "INTEL",     art: "Rhystic Study",    key: "intel" as const,  unit: "signals" },
  { href: "/watchlist", label: "WATCHLIST", art: "Esper Sentinel",   key: null,              unit: "" },
];

export default function LandingClient({ data }: { data: LandingData }) {
  // null until mount so SSR markup is stable; resolved to true/false client-side.
  const [firstLoad, setFirstLoad] = useState<boolean | null>(null);

  useEffect(() => {
    const seen = window.sessionStorage.getItem(LANDING_SEEN_KEY);
    setFirstLoad(!seen);
    window.sessionStorage.setItem(LANDING_SEEN_KEY, "1");
  }, []);

  const stateClass = firstLoad === null ? "" : firstLoad ? "is-dealing" : "is-settled";

  return (
    <div className={`relative z-0 max-w-5xl mx-auto px-4 md:px-8 py-8 ${stateClass}`}>
      {/* Row 1: brand + search */}
      <div className="deal deal-1 flex items-center justify-between mb-6 gap-4">
        <span className="font-display text-2xl text-gold-light">
          MTG<span className="text-white font-normal">Intel</span>
        </span>
        <div className="flex-1 max-w-md"><SearchBar /></div>
      </div>

      {/* Row 2: nav tiles */}
      <div className="deal deal-2 grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-8">
        {NAV.map((n) => (
          <NavTile
            key={n.href}
            href={n.href}
            label={n.label}
            artName={n.art}
            count={n.key ? `${data.navCounts[n.key]} ${n.unit}` : undefined}
          />
        ))}
      </div>

      {/* Row 3: Hot right now */}
      <div className="deal deal-3">
        <SectionLabel>Hot right now</SectionLabel>
      </div>
      <div className="flex flex-wrap gap-3.5 mb-8">
        {data.cards.length === 0 ? (
          <p className="font-mono text-sm text-neutral italic">No hot cards yet — check back after the next ingest.</p>
        ) : (
          data.cards.map((c, i) => (
            <div key={`${c.card_name}-${i}`} className={`deal deal-g${Math.min(i + 1, 5)}`}>
              <CardTile
                cardName={c.card_name}
                price={c.price}
                delta={c.delta}
                verdict={c.verdict ?? undefined}
                loadOnFlip
                signature={firstLoad === true && i === 0}
                size="sm"
              />
            </div>
          ))
        )}
      </div>

      {/* Row 4: movers ticker */}
      <div className="deal deal-4">
        <SectionLabel>Today&apos;s movers</SectionLabel>
        <MoversTicker movers={data.movers} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + build**

Run: `npx vitest run __tests__/ui-overhaul.test.tsx && npm run build`
Expected: PASS (all LandingClient tests) and clean build.

- [ ] **Step 5: Commit**

```bash
git add components/LandingClient.tsx __tests__/ui-overhaul.test.tsx
git commit -m "feat: add LandingClient shell with once-per-session entrance motion"
```

---

## Task 11: Rebuild `app/page.tsx`

**Files:**
- Replace: `app/page.tsx`

The landing page becomes an async Server Component that fetches data through `getLandingData()` (calling lib functions directly — no fetch-to-self) and renders the nebula + client shell. Per AGENTS.md, confirm the async Server Component data-fetch pattern in `node_modules/next/dist/docs/01-app/` before writing.

- [ ] **Step 1: Confirm the framework pattern**

Run: `ls node_modules/next/dist/docs/01-app/01-getting-started/`
Read the data-fetching / server-components getting-started doc to confirm `export default async function Page()` with direct `await` is current. Expected: async Server Components fetch data directly; no `getServerSideProps`.

- [ ] **Step 2: Replace `app/page.tsx`**

```tsx
import ManaNebula from "@/components/ManaNebula";
import LandingClient from "@/components/LandingClient";
import { getLandingData } from "@/lib/landing";

// Landing reads live data (movers, hot signals); render per request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const data = await getLandingData();
  return (
    <div className="min-h-[calc(100vh-64px)]">
      <ManaNebula />
      <LandingClient data={data} />
    </div>
  );
}
```

- [ ] **Step 3: Build and run the full suite**

Run: `npm run build && npm test`
Expected: clean build, all tests pass. The old `pulse-gold`/feature-card landing markup is gone (the only `pulse-gold` usage was here).

- [ ] **Step 4: Manual smoke check (dev server)**

Run: `npm run dev` then open `http://localhost:3000`.
Expected: search row, four art nav tiles with counts, a "Hot right now" flip-card grid (click a card → it flips and lazy-loads its chart), and a movers ticker. On first load the sections deal in; reload within the session → no re-deal.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat: rebuild landing page as card-first Direction C"
```

---

## Task 12: NavBar restyle

**Files:**
- Modify: `components/NavBar.tsx`

Slim the desktop nav to brand + the four destinations + search; trim the mobile bottom bar to the same four destinations (drop the redundant "Home"/"Search" entries — search lives in the bar/landing). Keep it calm: remove the gold pill backgrounds in favor of a quiet active underline.

- [ ] **Step 1: Update the links array and active styling**

Replace the `links` array in `components/NavBar.tsx`:

```tsx
const links = [
  { href: "/market",    label: "Market",    icon: TrendingUp },
  { href: "/hot",       label: "Hot",       icon: Flame },
  { href: "/intel",     label: "Intel",     icon: Zap },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
];
```

Remove the now-unused `Home`, `Search` imports from the lucide import line (keep `Search` only if still used by the mobile brand bar's search link — it is, so keep `Search`; remove `Home`). In the desktop nav, change the active class from the gold pill to a quiet treatment:

```tsx
className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
  active ? "text-gold-light" : "text-neutral hover:text-white"
}`}
```

and drop the `badge` rendering block (no more "Soon" — Intel is live). Apply the same four-link list to the mobile bottom bar, removing its `badge` usage too.

- [ ] **Step 2: Build and test**

Run: `npm run build && npm test`
Expected: clean build (no unused-import or undefined-variable errors), all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/NavBar.tsx
git commit -m "feat: slim NavBar to four destinations with quiet active state"
```

---

## Task 13: Final verification + PR

**Files:** none (verification + PR only)

- [ ] **Step 1: Full suite + build**

Run: `npm test && npm run build`
Expected: all tests pass; `✓ Compiled successfully`.

- [ ] **Step 2: Reduced-motion sanity check**

In the dev server, enable "Reduce motion" in the OS/browser and reload `/`. Expected: nebula static, no entrance stagger, no foil/trace/ping — page fully usable and complete.

- [ ] **Step 3: Push the branch and open the PR**

```bash
git push -u origin feat/ui-overhaul-phase-a
gh pr create --title "feat: UI overhaul Phase A — card-first landing, universal flip CardTile, motion system" --body "$(cat <<'EOF'
## Summary
- Rebuilds the landing page as Direction C: search row → art nav tiles → "Hot right now" flip-card grid → movers ticker
- Generalizes ProjectionFlipCard into a universal CardTile (front art + price/verdict, back chart); ProjectionFlipCard stays as a thin re-export so watchlist + ProjectionPanel are untouched
- Adds shared components: SectionLabel, NavTile, MoversTicker, ManaNebula
- Adds a three-tier motion system (Mana Nebula · Foil Sheen + Gold Trace · Opening Hand + Top Card), all gated behind prefers-reduced-motion
- Slims NavBar to the four destinations

## Test Plan
- [ ] `npm test` — all suites pass
- [ ] `npm run build` — clean
- [ ] Landing renders nav tiles with live counts, flip-card grid, ticker
- [ ] Clicking a hot card flips it and lazy-loads its chart
- [ ] First visit deals in; same-session reload does not re-animate
- [ ] prefers-reduced-motion disables all motion; page stays complete

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Report the PR URL to the user for review.** Do not merge — the user reviews and decides (per project workflow).

---

## Notes for the implementer

- **Scryfall images need no API call** — the `cards/named?...&format=image` URL *is* the image. `NavTile` and `CardTile` use it directly.
- **Do not delete shared CSS classes** (`rainbow-bar`, `.noise`, etc.) used by not-yet-rebuilt pages (market/hot/intel/card-detail). Phase A only replaces `app/page.tsx`; those pages are Phase B.
- **`ProjectionFlipCard` must keep working** — `app/watchlist/page.tsx` and `components/ProjectionPanel.tsx` import it. The wrapper in Task 6 preserves their behavior; do not change their call sites in Phase A.
- **One flip meaning per card:** the click flip is art↔chart. The Top Card signature (Task 10) is a foil sweep + ribbon ping on the lead tile — not a face-down deal — per the design spec's reconciliation.
