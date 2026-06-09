# Phase 2 GUI Design Spec
**Date:** 2026-06-09  
**Scope:** Frontend display layer for the Phase 2 intelligence loop — signal cards, enhanced price chart, intel feed page, card detail enhancements.

---

## Goals

Surface the intelligence signals produced by the Phase 2 backend (Reddit/YouTube ingestion → hybrid analysis → Supabase) in a way that feels like a real trading platform while staying true to the MTG card game aesthetic. Both casual players and serious finance users should immediately understand what's moving and why.

---

## Design System Additions

### Typography
- **Card names:** `Chakra Petch` (700 weight) — angular, futuristic, game-tech energy. Replaces `Playfair Display` for card name headings only.
- **Data / UI:** `JetBrains Mono` — unchanged, all prices, labels, badges, metrics.

Load from Google Fonts:
```
https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@400;700&display=swap
```

### Color Tokens (additions to existing palette)
| Token | Value | Usage |
|---|---|---|
| `--momentum-purple` | `#a855f7` | Momentum score, chart line, glow |
| `--momentum-indigo` | `#6366f1` | Gradient start, arc layer |
| `--momentum-pink` | `#ec4899` | Velocity, trending badge |
| `--ma-gold` | `#d4af37` | 30-day MA line (existing gold reused) |
| `--bull-green` | `#22c55e` | Bullish signal (existing) |
| `--bear-red` | `#ef4444` | Bearish signal (existing) |

### Rainbow Accent Bar
A 2px top border applied to all primary card components:
```css
background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899, #d4af37);
```

---

## Hybrid Card Component

Used on `/cards/[id]` (price section) and as a standalone summary card wherever a card is referenced.

### Layout
```
┌─ rainbow accent bar ──────────────────────────────────┐
│  [card art]   Card Name (Chakra Petch, gold)          │
│  56×78px      Modern · Pioneer · Legacy (mono, gray)  │
│  purple glow  [▲ BUY SIGNAL] [◆ HOT] [⚡ TRENDING]   │
│               Momentum ████████░░ 85                  │
│               $38.50  ▲ 12.3%  (right-aligned)        │
├───────────────────────────────────────────────────────┤
│  SIGNALS (7d)  │  SENTIMENT  │  VELOCITY              │
│  47 (purple)   │  BULL (green)│  ↑↑↑ (pink)           │
├───────────────────────────────────────────────────────┤
│  [price chart — see Chart spec below]                 │
│  [1M] [3M] [6M*] [1Y] [ALL]                           │
└───────────────────────────────────────────────────────┘
```

### Card Art
- Dimensions: 56×78px (inline), 62×87px (detail page)
- Border: 1.5px solid `rgba(212,175,55,0.38)` (gold tint)
- Background: `linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)` (placeholder until Scryfall art loads)
- Box shadow: `0 0 20px rgba(168,85,247,0.31)`
- Source: Scryfall image URI (`image_uris.normal` or `card_faces[0].image_uris.normal`)

### Signal Badges
```
▲ BUY SIGNAL   — green (#22c55e), shown when sentiment is bullish
▼ SELL SIGNAL  — red (#ef4444), shown when sentiment is bearish
◆ HOT          — purple (#a855f7), shown when momentum ≥ 70
⚡ TRENDING    — pink (#ec4899), shown when velocity is high (≥ 3 new signals in 24h)
```
Badge style: `background: {color}18; color: {color}; border: 1px solid {color}40; padding: 3px 10px; border-radius: 12px; font-size: 11px`

### Momentum Bar
- Track: `#1a1a2e`, height 5px, border-radius 3px
- Fill: `linear-gradient(90deg, #6366f1, #a855f7, #ec4899)`
- Score: integer 0–100. Phase 2 formula (using available data): `clamp(0, (signal_count_7d * 3) + (avg_strength * 20) + (price_delta_pct * 2), 100)` where `signal_count_7d` is signals in the last 7 days, `avg_strength` is average `signal_strength` from `intel_signals`, and `price_delta_pct` is the 7-day price change percentage. Phase 3 will replace this with the full weighted momentum formula.

### Metric Pills
Three equal-width pills: Signals (7d) / Sentiment / Velocity.  
Style: `background: #0d0d1a; border: 1px solid #1a1a2e; border-radius: 6px; padding: 8px; text-align: center`

---

## Price Chart

Implemented as an HTML Canvas element. Replaces the existing recharts-based chart on `/cards/[id]`.

### Features
1. **Price line** — smooth curve through daily price snapshots
2. **30-day Moving Average** — dashed gold line (`#d4af37`, 1.5px, `setLineDash([4,3])`)
3. **Volume bars** — rendered in the bottom 25% of the canvas; green for up-days, red for down-days, 50% opacity
4. **Price fill** — gradient fill under the price line, purple → transparent

### Lightning Draw-in Animation
Triggers on page load and on timeframe tab change. Duration: ~1.5s (90 frames at 60fps).

Each frame draws progressively more of the path, with at the leading tip:
- **Outer corona** — radial gradient `rgba(255,255,255,0.9)` → `rgba(168,85,247,0)`, radius ~15px
- **Bright core** — white circle, `shadowBlur: 14`, `shadowColor: #e879f9`
- **Lightning arcs** — 2–5 short jagged branches (10–25px), flickering every other frame; 1–2 forward-pointing arcs along the path direction
- **Particles** — 3 purple/pink particles spawned every 3 frames from the tip, fade out over ~25 frames

After animation completes, a pulsing end-dot remains at the current price point.

### Canvas Layers (draw order)
1. Volume bars (bottom region)
2. Volume separator line
3. Price gradient fill
4. MA line (dashed gold)
5. Price line outer glow (purple, blurred)
6. Price line core (bright white-purple)
7. Lightning tip effects (during animation only)
8. Particles
9. End dot (after animation)

### Timeframe Tabs
`1M · 3M · 6M · 1Y · ALL` — active tab styled with purple tint, triggers data refetch + animation replay.

---

## Intel Feed Page (`/intel`)

### Stats Bar
Row of 3–4 at-a-glance metrics above the feed:
```
Total Signals Today  |  Bullish / Bearish ratio  |  Top Momentum Card  |  Last Ingested
```
Style: same `#0d0d1a` pill / metric style as the hybrid card metrics row.

### Signal Cards
Each signal in the feed renders as a signal card:

```
┌─ [left border: 3px gradient — green or red] ───────────┐
│ [card art 40×56px]  Card Name (Chakra Petch)            │
│                     Source · time · score               │
│                     "quote snippet..."                  │
│                     [▲ BULLISH] [◆ 85 momentum]        │
│                                     $38.50  ▲ 12.3%    │
└────────────────────────────────────────────────────────┘
```

Left border color: `linear-gradient(to bottom, #22c55e, #6366f1)` for bullish; `linear-gradient(to bottom, #ef4444, #6366f1)` for bearish.  
Card border: `1px solid rgba(34,197,94,0.19)` (bullish) or `rgba(239,68,68,0.19)` (bearish).

### Feed Slide-in Animation
On page load, signal cards stagger in from below:
```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(18px); }
  to   { opacity: 1; transform: translateY(0); }
}
.signal-card { animation: slideUp 0.4s ease both; }
.signal-card:nth-child(1) { animation-delay: 0s; }
.signal-card:nth-child(2) { animation-delay: 0.15s; }
.signal-card:nth-child(3) { animation-delay: 0.30s; }
.signal-card:nth-child(4) { animation-delay: 0.45s; }
.signal-card:nth-child(5) { animation-delay: 0.60s; }
.signal-card:nth-child(6) { animation-delay: 0.75s; }
/* cards 7+ get no delay — animation still applies, appears immediately */
```
Max stagger: first 6 cards only; cards 7+ appear instantly to avoid long waits.

---

## Card Detail Page (`/cards/[id]`)

### Price Section
Replace the existing price box + recharts chart with the Hybrid Card Component (minus the card art thumbnail — the full card art is already displayed as the page hero).

Layout on `/cards/[id]`:
- Card art displayed full-size as existing hero (no change)
- Below art: price + badges + momentum bar + metric pills + canvas chart + timeframe tabs

### "What People Are Saying" Section
Already exists as a placeholder. With Phase 2 data live, populate with signal cards from the intel feed filtered by `card_name`. Same signal card design as the feed. Empty state (no signals yet) remains as-is.

---

## Card Hover Animation (Glow Lift)

Applied to any card component rendered in a list or grid context (not on the card detail page itself):

```css
.card-component {
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.card-component:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow: 0 12px 40px rgba(168,85,247,0.31);
}
.card-component:hover .card-art {
  box-shadow: 0 0 24px rgba(168,85,247,0.38);
}
```

---

## New Components

| Component | Location | Notes |
|---|---|---|
| `<PriceChart>` | `components/PriceChart.tsx` | Canvas-based, accepts `prices[]`, `ma30[]`, `volume[]`, `timeframe` |
| `<SignalCard>` | `components/SignalCard.tsx` | Intel feed row; accepts `IntelSignal` + `priceData` |
| `<MomentumBar>` | `components/MomentumBar.tsx` | Score bar + numeric display |
| `<CardHero>` | `components/CardHero.tsx` | Card art + name + badges + momentum; used in hybrid card layout |

`PriceChart` owns the canvas animation internally — no animation state leaks to parent. Replay triggered by changing the `timeframe` prop.

---

## Out of Scope (Phase 3)

- Hot Cards / momentum leaderboard page
- User watchlists
- Price alerts
- Candlestick chart mode (requires OHLC data not yet available)
