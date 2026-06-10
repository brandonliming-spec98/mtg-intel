# Phase 2 GUI Design Spec (v2)

**Date:** 2026-06-10  
**Supersedes:** `2026-06-09-phase2-gui-design.md`  
**Scope:** Complete frontend design for Phase 2 — card detail page (Card Gallery layout), intelligence panel, sparkline chart, card hero animation, intel feed page polish.

---

## Goals

Surface Phase 2 intelligence signals (Reddit/YouTube → hybrid analysis → Supabase) in a way that feels like a real trading platform while staying true to the MTG card game aesthetic. Casual players and serious finance users should both immediately understand what's moving and why.

---

## Design System

### Typography
- **Card names:** `Chakra Petch` (700 weight) — angular, futuristic. Used for card name headings only.
- **Data / UI:** `JetBrains Mono` — all prices, labels, badges, metrics.

```
https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@400;700&display=swap
```

### Color Tokens
| Token | Value | Usage |
|---|---|---|
| `--bull-green` | `#22c55e` | Bullish signal, bar fills |
| `--bear-red` | `#ef4444` | Bearish signal |
| `--momentum-purple` | `#a855f7` | Score ring, momentum bar |
| `--momentum-indigo` | `#6366f1` | Gradient start |
| `--momentum-pink` | `#ec4899` | Trending badge |
| `--ma-gold` | `#d4af37` | Price MA line, card border tint |

### Rainbow Accent Bar
2px top border on all primary card components:
```css
background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #d4af37);
```

### Signal Badges
```
▲ BUY    — #22c55e, shown when sentiment is bullish
▼ SELL   — #ef4444, shown when sentiment is bearish
◆ HOT    — #a855f7, shown when score ≥ 70
⚡ WATCH  — #d4af37, shown when score 40–69
```
Badge style: `background: {color}18; color: {color}; border: 1px solid {color}40; padding: 3px 10px; border-radius: 12px; font-size: 11px`

---

## Page Layout — Card Detail (`/cards/[id]`)

Two-zone Card Gallery layout:

**Top zone — horizontal split:**
- Left 40%: Card Hero (large card art, 3D tilt animation)
- Right 60%: Intelligence Panel (score ring + sub-bars + quote feed)

**Bottom zone — full-width:**
- Sparkline chart with signal event annotations + time range tabs

On mobile: top zone stacks vertically (hero above, panel below). Chart remains full-width below.

---

## Card Hero Component

Large card art image (~280px wide) sourced from Scryfall `image_uris.normal` (or `card_faces[0].image_uris.normal` for DFCs).

### 3D Tilt
- `perspective` + `rotateX/rotateY` CSS transforms driven by `mousemove` coordinates relative to the card element
- Max tilt: ±15° on each axis
- Easing: `transition: transform 0.1s ease-out` — snappy follow, smooth release
- On `mouseleave`: animate back to `rotateX(0) rotateY(0)` over 0.4s
- Implementation: ~30 lines of vanilla JS in a React `useEffect` hook, no library
- Mobile: tilt disabled entirely (touch devices get static card)

### Drop Shadow
Color derived from card's color identity, no image analysis:
- W → `rgba(255,255,255,0.3)`
- U → `rgba(88,166,255,0.4)`
- B → `rgba(168,85,247,0.4)`
- R → `rgba(239,68,68,0.4)`
- G → `rgba(34,197,94,0.4)`
- Gold (multicolor) → `rgba(212,175,55,0.4)`
- Colorless → `rgba(150,150,150,0.3)`

Applied as `box-shadow: 0 16px 48px {color}`.

### Foil Shimmer
Applied when the **currently viewed printing** has `foil: true` (Scryfall boolean on the printing object, not on the card root). A pseudo-element sweeps a prismatic gradient across the card face on loop:
```css
.card-hero.foil::before {
  content: '';
  position: absolute;
  inset: -50%;
  background: linear-gradient(
    105deg,
    transparent 20%,
    rgba(255,255,255,0.04) 30%,
    rgba(180,100,255,0.15) 38%,
    rgba(100,200,255,0.2) 42%,
    rgba(255,200,100,0.15) 46%,
    rgba(100,255,180,0.1) 50%,
    rgba(255,255,255,0.04) 58%,
    transparent 70%
  );
  animation: foilSweep 3s linear infinite;
  pointer-events: none;
}
@keyframes foilSweep {
  from { transform: translateX(-60%) translateY(-60%); }
  to   { transform: translateX(60%) translateY(60%); }
}
```

---

## Intelligence Panel

Right column (60% width) beside the card hero. Two stacked sections.

### Score Block

- Signal badge (BUY / SELL / WATCH) + card name (Chakra Petch)
- Conic-gradient CSS score ring (no canvas, no chart lib):
  ```css
  background: conic-gradient(#a855f7 0% {score}%, #21262d {score}% 100%);
  ```
  Inner circle (`#0d1117`) overlaid to create donut. Score number centered inside.
- Four sub-score bars below the ring:
  | Label | Max |
  |---|---|
  | Mention Volume | 35 |
  | Sentiment | 30 |
  | Price Momentum | 20 |
  | Supply Scarcity | 15 |

  Each bar: track `#21262d`, fill `#22c55e` (bullish) or `#ef4444` (bearish), height 4px, border-radius 2px. Score shown as `n/max` right-aligned.

### Source Quote Feed

Below the score block, labeled "Sources".

Scrollable list of quote cards from the `intel_signals` table. Each entry:
- Colored left border (3px): `#22c55e` for bullish quotes, `#ef4444` for bearish
- Source label: subreddit name or YouTube channel, upvote/view count
- Quote text (truncated to ~120 chars)
- Default: show top 4 by `signal_strength` desc
- "+ N more sources" expand link reveals remaining rows inline

Data already available from `fetchSignals()` in `lib/supabase-signals.ts`. No new backend work.

---

## Price Chart (Sparkline)

Full-width below the top zone. Built with **Recharts** `AreaChart`.

### Visual
- Area chart, smooth curve (`type="monotone"`)
- Gradient fill: green when current price ≥ 30-day open, red when below
- No visible grid lines — clean background
- Time range tabs: `1W · 1M · 3M · 1Y · ALL` — switches visible data window client-side, no refetch. Active tab: purple tint background.

### Signal Event Annotations
Vertical dashed marker lines at dates where an `intel_signal` was stored for this card:
- Line color: `#d4af37` (gold), dashed
- Small dot at the price at that date
- Hover tooltip: source type (Reddit/YouTube) + signal direction

Implemented as a Recharts `ReferenceLine` per signal date.

### Data Source
Scryfall `/cards/{id}` returns `prices` (today's price only). For historical price data, use the **MTGJSON** `AllPrices.json` bulk download, which provides daily TCGPlayer price history per card UUID. Fetch the relevant card's history on the server side in `app/cards/[id]/page.tsx` and pass as props to `<PriceChart>`.

---

## Intel Feed Page (`/intel`)

Existing structure kept. Visual additions per signal row:

- **Card art thumbnail**: Scryfall `image_uris.art_crop`, 40×56px, left-aligned, gold border tint
- **Signal strength bar**: thin (4px) colored bar below card name, fill = `score / 100`
- **Source count badge**: "14 sources" pill beside the signal badge
- **Click target**: entire row links to `/cards/[id]`

### Slide-in Animation (page load)
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
.signal-card:nth-child(n) { animation: slideUp 0.4s ease both; }
```
Stagger delay: `nth-child * 0.15s`, capped at 6 cards (cards 7+ have no delay).

---

## New Components

| Component | Path | Props |
|---|---|---|
| `<CardHero>` | `components/CardHero.tsx` | `card: ScryfallCard`, `foil?: boolean` |
| `<IntelPanel>` | `components/IntelPanel.tsx` | `signals: IntelSignal[]`, `score: number`, `subScores: { volume: number, sentiment: number, momentum: number, scarcity: number }` |
| `<PriceChart>` | `components/PriceChart.tsx` | `prices: {date, usd}[]`, `signalDates: string[]`, `timeframe: string` |
| `<SignalCard>` | `components/SignalCard.tsx` | `signal: IntelSignal`, `price?: number`, `priceDelta?: number` |
| `<ScoreRing>` | `components/ScoreRing.tsx` | `score: number`, `label: string` |

`PriceChart` owns timeframe state internally. `IntelPanel` owns quote expand/collapse state internally.

---

## Out of Scope (future phases)

- Hot Cards / momentum leaderboard page
- User watchlists or price alerts
- Candlestick / OHLC chart mode
- Card comparison view
