# Phase 4 — Mechanics Analysis Engine Design
**Date:** 2026-06-09
**Scope:** Add a hybrid card mechanics scoring engine (break score, ban risk, format scores) that runs at ingest time and on-demand, stores results in Supabase, and surfaces scores on the card detail page.

---

## Goals

- Score any MTG card's mechanics for format effectiveness, break potential, and ban likelihood
- Surface ban risk as a price ceiling signal in the intel UI
- Run proactively during ingest (cards appearing in signals) and on-demand (card detail page)
- Keep costs low: rule-based + mtg-oracle for all cards, Claude only for high-break cards

---

## Architecture

```
Card mentioned in signal
        │
        ▼
mechanics-analyzer.ts
  ├─ Tier 1: rule-based weight table   (always)
  ├─ Tier 2: mtg-oracle CLI subprocess  (always)
  └─ Tier 3: Claude synthesis           (break_score ≥ 7 only)
        │
        ▼
 card_mechanics (Supabase table)
        │
        ├──► ingest pipeline (score cards from signals at ingest time)
        └──► /api/mechanics/[cardId] (on-demand, cached 7 days)
```

---

## Data Model

### `MechanicsProfile` (added to `types/index.ts`)

```typescript
type FormatKey = "standard" | "pioneer" | "modern" | "legacy" | "commander";

export interface MechanicsProfile {
  card_id: string;
  card_name: string;
  mechanics: string[];
  format_scores: Record<FormatKey, number>;
  break_score: number;          // 0–10
  ban_risk: number;             // 0–1 float
  ban_risk_by_format: Partial<Record<FormatKey, number>>;
  price_ceiling_flag: boolean;  // true when ban_risk > 0.5
  ban_reasoning?: string;       // Claude-generated one-sentence explanation (high-break cards only)
  tier_used: "rule_based" | "mtgoracle" | "claude";
  computed_at: string;          // ISO timestamp
}
```

### Supabase `card_mechanics` table

```sql
create table card_mechanics (
  card_id            text primary key,
  card_name          text not null,
  mechanics          jsonb not null default '[]',
  format_scores      jsonb not null default '{}',
  break_score        numeric(4,2) not null default 0,
  ban_risk           numeric(4,3) not null default 0,
  ban_risk_by_format jsonb not null default '{}',
  price_ceiling_flag boolean not null default false,
  ban_reasoning      text,
  tier_used          text not null,
  computed_at        timestamptz not null default now()
);
```

Cache TTL: 7 days. Profiles older than 7 days are re-scored on next request.

---

## Mechanics Analyzer (`lib/mechanics-analyzer.ts`)

Single exported function:

```typescript
export async function analyzeMechanics(
  card: ScryfallCard,
  deps?: MechanicsAnalyzerDeps
): Promise<MechanicsProfile>
```

All external calls (mtg-oracle subprocess, Claude API) are injected via `deps` for testability.

### Tier 1 — Rule-Based Weight Table

Extracts mechanics from `card.keywords` (Scryfall array) and `card.oracle_text` (regex patterns). Each mechanic has an additive weight:

| Mechanic | Break Δ | Format Ban Risk Δ |
|---|---|---|
| `extra_turn` | +3 | modern +0.4, legacy +0.3 |
| `cascade` | +2 | modern +0.3 |
| `companion` | +3 | all formats +0.5 |
| `copy_permanent` | +2 | modern +0.35 |
| `free_spell` | +2 | legacy +0.2, modern +0.2 |
| `ramp_land` | +2 | standard +0.3, pioneer +0.2 |
| `treasure_gen` | +1 | commander +0.1 |
| `cantrip` | +1 | modern +0.15 |
| `reanimation` | +1.5 | legacy +0.2 |
| `tutor` | +1.5 | legacy +0.25, commander +0.15 |
| `escape` / `delve` | +2 | modern +0.3 |
| `haste` | +0.5 | — |
| `flash` | +1 | modern +0.1 |
| `lock_effect` | +2.5 | all formats +0.2 |

Scores are summed and capped: `break_score` max 10, `ban_risk` per format max 1.0.

Format scores (0–10) start at the card's EDHREC rank proxy and are boosted by mechanics that are strong in that format. Cards illegal in a format receive score 0.

Produces: initial `break_score`, `format_scores`, `ban_risk_by_format`, `mechanics[]`.
Sets `tier_used: "rule_based"`.

### Tier 2 — mtg-oracle Enrichment

Always runs after Tier 1. Calls `npx mtg-oracle` as a child process to get:
- Combo count for the card (`find_combos`)
- EDHREC rank (`search_cards`)
- Format staple tier (`get_format_staples`)

Adjustments:
- Each combo found: `break_score += 0.5` (capped at +2 total)
- High EDHREC rank (≤ 500): `format_scores.commander += 2`
- Format staple (tier 1): `format_scores[format] += 1.5`

Updates `tier_used: "mtgoracle"`.

If the subprocess fails or times out (5s timeout): skip Tier 2 silently, keep Tier 1 scores.

### Tier 3 — Claude Synthesis

Runs only when `break_score ≥ 7` after Tier 2.

Prompt includes: oracle text, Tier 1+2 scores, format legalities. Claude returns adjusted scores and a one-sentence `ban_reasoning`. Max 256 output tokens (JSON only).

```typescript
// Claude response schema:
{
  break_score: number,
  ban_risk: number,
  ban_risk_by_format: Record<string, number>,
  format_scores: Record<string, number>,
  ban_reasoning: string  // persisted to card_mechanics.ban_reasoning
}
```

If Claude fails: keep Tier 1+2 scores, `tier_used` stays `"mtgoracle"`.
If Claude succeeds: update all scores, set `tier_used: "claude"`.

Sets `price_ceiling_flag: ban_risk > 0.5`.

---

## Mechanics Profiles (`lib/mechanics-profiles.ts`)

```typescript
// Supabase read — returns null if not found
export async function getMechanicsProfile(
  cardId: string,
  client?: Client
): Promise<MechanicsProfile | null>

// Supabase upsert (insert or replace by card_id)
export async function upsertMechanicsProfile(
  profile: MechanicsProfile,
  client?: Client
): Promise<void>

// true if computed_at is older than 7 days
export function isStale(profile: MechanicsProfile): boolean

// Thin wrapper: calls GET /api/mechanics/[cardId], returns null on any error
// Used by app/cards/[id]/page.tsx
export async function fetchMechanicsProfile(
  cardId: string
): Promise<MechanicsProfile | null>
```

`scoreNewCards` helper (defined in `lib/mechanics-profiles.ts`, used by both ingest orchestrators):

```typescript
// Fetches Scryfall card for each name, skips cards scored within 7 days,
// runs analyzeMechanics on the rest, upserts results.
// Returns count of scored cards and any per-card errors.
export async function scoreNewCards(
  cardNames: string[],
  deps?: { scoreMechanics?: (card: ScryfallCard) => Promise<MechanicsProfile> }
): Promise<{ scored: number; errors: string[] }>
```

---

## API Endpoint (`app/api/mechanics/[cardId]/route.ts`)

`GET /api/mechanics/[cardId]`

1. Fetch from `card_mechanics` where `card_id = cardId`
2. If found and not stale: return 200 with profile
3. If missing or stale: fetch card from Scryfall, run `analyzeMechanics`, upsert, return 200
4. If Scryfall returns 404: return 404
5. No auth required (public read)

---

## Ingest Integration

Both `lib/ingest-reddit.ts` and `lib/ingest-youtube.ts` add a `scoreMechanics` dep (optional, defaults to the real scorer). After `storeSignals`, a `scoreNewCards` helper:

1. Collects unique card names from stored signals
2. For each name: fetch Scryfall card, check `card_mechanics` for freshness
3. Skips cards scored within 7 days
4. Scores and upserts the rest
5. Errors per card are caught, added to `result.errors[]`, never block ingest

```typescript
interface IngestDeps {
  // existing...
  scoreMechanics?: (card: ScryfallCard) => Promise<MechanicsProfile>;
}
```

---

## Card Detail UI (`app/cards/[id]/page.tsx`)

Added parallel fetch:

```typescript
const [card, rulings, prints, mechanics] = await Promise.all([
  getCardById(id),
  getCardRulings(id),
  getCardPrints(""),
  fetchMechanicsProfile(id).catch(() => null),
]);
```

New panel renders below Oracle Text when `mechanics` is non-null:

**Score chips row:**
- Break Score chip — color-coded: green (≤4), yellow (5–6), orange (7–8), red (≥9)
- Ban Risk chip — LOW / MEDIUM / HIGH / CRITICAL (derived from `ban_risk` float: <0.2, <0.4, <0.6, ≥0.6)
- Top format chip — whichever format has the highest score

**Mechanics tags:** pill badges listing extracted mechanic names

**Price ceiling warning:** shown only when `price_ceiling_flag: true`
```
⚠ Ban Risk Ceiling
High break score limits upside. Ban probability caps long-term price appreciation.
```

**Format scores grid:** 5-column bar chart (Standard / Pioneer / Modern / Legacy / Commander), 0–10 scale, thin filled bar + number per column

No new npm dependencies — uses existing Tailwind classes and panel style.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| mtg-oracle subprocess fails / times out | Skip Tier 2, use Tier 1 scores |
| Claude API fails | Skip Tier 3, use Tier 1+2 scores |
| Scryfall fetch fails in on-demand API | Return 404 |
| `card_mechanics` upsert fails | Log error, return computed profile to caller |
| Ingest scoring fails for one card | Add to `errors[]`, continue |
| `fetchMechanicsProfile` fails on card page | Page renders without mechanics panel |

---

## Testing

| File | Coverage |
|---|---|
| `__tests__/mechanics-analyzer.test.ts` | Tier 1 weight table accuracy; Tier 2 enrichment via injected dep; Tier 3 gating (break_score < 7 = no Claude call); DI for all external calls; `price_ceiling_flag` threshold |
| `__tests__/mechanics-profiles.test.ts` | Cache hit returns existing; staleness check (7-day boundary); upsert called on miss |
| `__tests__/api-mechanics.test.ts` | Cache hit → 200 with profile; cache miss → score + upsert + 200; Scryfall 404 → 404 |

All external calls (Scryfall, mtg-oracle subprocess, Claude, Supabase) injected via `deps` — tests run fully offline.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/mechanics-analyzer.ts` | 3-tier scoring engine |
| Create | `lib/mechanics-profiles.ts` | Supabase CRUD, staleness check, `scoreNewCards`, `fetchMechanicsProfile` |
| Create | `app/api/mechanics/[cardId]/route.ts` | On-demand GET endpoint |
| Modify | `lib/ingest-reddit.ts` | Add `scoreNewCards` call after storeSignals |
| Modify | `lib/ingest-youtube.ts` | Add `scoreNewCards` call after storeSignals |
| Modify | `app/cards/[id]/page.tsx` | Add mechanics panel + parallel fetch |
| Modify | `types/index.ts` | Add `MechanicsProfile` interface |

---

## Out of Scope

- NotebookLM query integration (Phase 4b — richer research context, separate spec)
- Intel feed ban-risk badges (separate UI spec)
- Bulk re-scoring all existing cards (can be triggered manually via API if needed)
- Price alert integration (future phase)
