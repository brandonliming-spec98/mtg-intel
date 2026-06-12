# Design: Watchlist, Push Notifications, Ban-Risk Badges

**Date:** 2026-06-11  
**Status:** Approved  
**Build order:** Ban-risk badges → Watchlist → Push notifications

---

## Overview

Three features that together give the app a personal monitoring layer:

1. **Ban-risk badges** — surface `ban_risk > 0.75` from the mechanics engine on intel feed cards
2. **Watchlist** — track specific card printings (set + finish) with watching/owned status
3. **Push notifications** — Web Push alerts for 5 trigger conditions on watched cards

Single-user for now (brandon.liming@gmail.com). Architecture is designed to expand to multi-user Supabase Auth without touching UI code.

---

## Feature 1 — Ban-Risk Badges

### What it does
Adds an orange `⚠ BAN RISK` badge to `SignalCard` when the underlying card's `ban_risk` score exceeds 0.75 according to the mechanics engine.

### Data flow
`/api/intel` route performs a LEFT JOIN against `card_mechanics` on `card_name_raw`. The `ban_risk` field (float 0–1) is appended to each signal in the JSON response. No additional client-side fetches needed.

### Display
Badge sits in the existing badge row alongside sentiment and momentum badges:
- Color: orange (`#f97316`)
- Label: `⚠ BAN RISK`
- Style: matches existing pill badge pattern (10px monospace, semi-transparent background, colored border)
- Threshold: `ban_risk > 0.75`

### Type change
`IntelSignal` gains an optional `ban_risk?: number` field. The API route populates it; the UI reads it.

### Mobile
Badge row already wraps on narrow screens. No extra work needed now. Future pass: consider collapsing to icon-only on very small screens.

---

## Feature 2 — Watchlist

### Data model

```typescript
interface WatchlistEntry {
  id: string;              // scryfall card id (unique per printing+finish)
  card_name: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  finish: "nonfoil" | "foil" | "etched";
  image_uri: string;
  status: "watching" | "owned";
  added_at: string;        // ISO timestamp
}
```

Stored in localStorage under key `mtgintel_watchlist` as a JSON array.

### `useWatchlist()` hook

```typescript
interface UseWatchlist {
  entries: WatchlistEntry[];
  add: (entry: WatchlistEntry) => void;
  remove: (id: string) => void;
  toggleStatus: (id: string) => void;   // watching ↔ owned
  isWatched: (id: string) => boolean;
}
```

All reads/writes go through this hook. Swapping to Supabase later = replace the hook internals only.

### Add modal

Triggered from:
- Card detail page (`/cards/[id]`) — pre-fills to the current printing
- Hot Cards page — opens with the card's default printing selected

Modal contents:
1. **Printing dropdown** — fetches `GET https://api.scryfall.com/cards/search?q=!"${cardName}"&unique=prints&order=released` and lists all printings as `${set_name} (${year}) · ${finish} · #${collector_number}`
2. **Status toggle** — "Watching" (◎, gold) vs "Own It" (●, green)
3. **Add / Cancel buttons**

### `/watchlist` page

- Two sections: **Own It** (green header) and **Watching** (gold header)
- Each row: card art thumbnail · card name · set + finish · live price (from `/api/prices`) · 7-day delta · ⋯ menu (Remove, Toggle status)
- Sort: default by `added_at` descending; sort/filter controls for set, finish, status
- Empty state with prompt to add cards from the intel feed or card detail pages

### Entry points
- **Card detail page** (`/cards/[id]`): "★ Watch" button in the price/action area
- **Hot Cards page** (`/hot`): "☆ Watch" icon button on each card row; fills to ★ when watched

### Multi-user migration path
When Supabase Auth is added:
1. Create `watchlist_entries` table: `id, user_id UUID REFERENCES auth.users, scryfall_id, card_name, set_name, set_code, collector_number, finish, status, added_at`. RLS: `user_id = auth.uid()`.
2. On first login: read localStorage `mtgintel_watchlist`, bulk-insert to Supabase, clear local key.
3. `useWatchlist()` internals swap to Supabase client queries. Hook interface unchanged — no UI changes needed.

### Mobile notes (future pass)
- Stack price column below card name on narrow screens
- Full-screen modal on mobile (currently sheet/dialog)
- Swipe-to-remove on watchlist rows

---

## Feature 3 — Push Notifications

### Infrastructure

**VAPID keys** (one-time setup):
```bash
npx web-push generate-vapid-keys
```
Store as Vercel env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:brandon.liming@gmail.com).

**Service worker** (`/public/sw.js`): handles `push` events, shows notification via `self.registration.showNotification()`.

**Subscription flow**:
1. App boot: register service worker, call `Notification.requestPermission()`
2. On grant: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`
3. `POST /api/push/subscribe` with subscription JSON → written to Supabase `push_subscriptions` table (no `user_id` for now, just a single row; uses service_role key server-side)

**Notify cron** (`/api/push/notify`): Vercel cron, runs hourly. Reads push subscription from Supabase `push_subscriptions`. Checks all 5 trigger conditions against Supabase + price APIs. Deduplicates via a `last_notified` column on the subscription row (JSONB map of `{cardId_trigger: ISO_timestamp}`). Sends pushes via `web-push` npm package.

### Trigger conditions

| Trigger | Condition | Notification copy |
|---|---|---|
| New signal | New `intel_signals` row for watched card since last check | "New signal: {card} — {sentiment} · {source}" |
| Price spike | Price up ≥ threshold% in 24h | "{card} up {delta}% · now ${price}" |
| Price drop | Price down ≥ threshold% in 24h | "{card} down {delta}% · now ${price}" |
| Ban risk spike | `card_mechanics.ban_risk` crosses 0.75 | "⚠ Ban risk: {card} in {format}" |
| Hot card | Card enters top 20 on Hot Cards dashboard | "{card} is trending · momentum {score}" |

**Default price threshold:** 10% — hardcoded in the cron. Override via `PRICE_ALERT_THRESHOLD` Vercel env var (e.g. `15` for 15%). Future settings page can write this to Supabase `app_settings`.

**Deduplication:** `last_notified` JSONB column on the `push_subscriptions` row stores `{ "${scryfallId}_${trigger}": ISO_timestamp }`. Each trigger type per card tracked independently. Re-fires after 24h if condition persists.

### Single-user cron approach
The cron reads the push subscription directly from Supabase `push_subscriptions` (expects exactly one row for now). No auth header needed — secured by Vercel cron secret (`CRON_SECRET` header).

### Multi-user migration path
1. Create `push_subscriptions` table: `id, user_id UUID REFERENCES auth.users, subscription JSONB, created_at`. RLS: `user_id = auth.uid()`.
2. Create `notification_preferences` table: `user_id, price_threshold DECIMAL, triggers JSONB`.
3. `/api/push/subscribe` writes to Supabase instead of env var.
4. Cron iterates `push_subscriptions` JOIN `watchlist_entries` — same trigger logic, fan-out per user.

### iOS PWA note
Web Push on iOS requires iOS 16.4+ and the app added to Home Screen. Browser tab on iOS does not receive push. Worth a one-line note on the `/watchlist` page settings area.

---

## Shared: `useWatchlist()` as the integration seam

Both the watchlist UI and the push notification cron depend on knowing which cards are watched. The browser writes the current watchlist to Supabase via `POST /api/push/sync-watchlist` whenever it changes (add/remove/toggle). The cron reads from the same Supabase `push_subscriptions` row (watchlist stored as JSONB alongside the subscription). For multi-user, replace with a `watchlist_entries` table query filtered by `user_id`.

---

## Out of Scope (this spec)

- Buy/sell platform integrations (TCGPlayer, etc.) — noted, not yet
- Settings UI for price threshold — direct localStorage edit for now
- Collection quantity / purchase price tracking — future enhancement
- Notification history / in-app inbox — future enhancement
