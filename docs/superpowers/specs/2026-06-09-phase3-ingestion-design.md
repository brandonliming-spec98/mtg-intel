# Phase 3 — Hybrid Analysis Engine + YouTube Ingestion Design
**Date:** 2026-06-09  
**Scope:** Upgrade the analysis pipeline to two-tier hybrid (rule-based + selective Claude), add YouTube RSS ingestion, and wire both sources into daily Vercel cron jobs.

---

## Goals

- Minimize Claude API cost by running Claude only on high-value content
- Add YouTube as a signal source (RSS-based, no API key required)
- Keep the ingest pipeline DI-friendly so new sources drop in without touching analysis logic

---

## Architecture

The existing pipeline is:

```
Source (Reddit) → extractSignalsFromText (Claude always) → storeSignals
```

After this build:

```
Source (Reddit | YouTube) → hybridAnalyze → storeSignals
                                ↓
                    Tier 1: rule-based (always)
                    Tier 2: Claude (high-value only)
```

`hybridAnalyze` has the same signature as `extractSignalsFromText` — it's a drop-in replacement. All existing and future sources call it identically.

---

## Hybrid Analysis Engine

### Tier thresholds

| Source | Claude runs when… |
|---|---|
| Reddit | post `score ≥ 100` |
| YouTube | always (RSS volume is small — ~15 videos/channel/run) |
| Future sources | configurable per-source in `hybrid-analysis.ts` |

When Claude runs, its result replaces the rule-based result entirely. When Claude does not run, rule-based signals are stored as-is.

### `lib/scryfall-catalog.ts`

Fetches the Scryfall card name catalog and caches it for the duration of the serverless instance lifetime.

```typescript
let catalog: Set<string> | null = null;

export async function getCardCatalog(): Promise<Set<string>>
```

- Fetches `https://api.scryfall.com/catalog/card-names` on first call (~30k names)
- Stores result in module-level `catalog` variable
- Subsequent calls within the same instance return the cached Set immediately
- If fetch fails, throws — callers handle gracefully by falling back to Claude

### `lib/rule-based-analysis.ts`

Scans post text for known card names, returns one `IntelSignal` per matched card.

```typescript
export async function ruleBasedAnalyze(input: AnalysisInput): Promise<IntelSignal[]>
```

- Calls `getCardCatalog()` to get the name Set
- Case-insensitive scan: for each card name in catalog, checks `text.toLowerCase().includes(name.toLowerCase())`
- Deduplicates: one signal per unique card name per post
- Returns signals with `sentiment: "neutral"`, `signal_strength: 3`, `summary: "Card mentioned in source"`
- Returns `[]` if no card names matched

### `lib/hybrid-analysis.ts`

```typescript
export interface HybridAnalysisInput extends AnalysisInput {
  score?: number; // Reddit score, YouTube view proxy, etc.
}

export async function hybridAnalyze(
  input: HybridAnalysisInput,
  deps?: { claude?: typeof extractSignalsFromText; ruleBased?: typeof ruleBasedAnalyze }
): Promise<IntelSignal[]>
```

Logic:
1. Run rule-based analysis first (always)
2. Determine if Claude should run: `source_type === "youtube"` OR (`source_type === "reddit"` AND `score >= 100`)
3. If Claude runs: return Claude result (overrides rule-based)
4. If Scryfall catalog fetch fails during rule-based: fall back to Claude regardless of score
5. If neither produces results: return `[]`

The `deps` parameter follows the existing DI pattern for testability.

---

## YouTube Ingestion

### `lib/youtube-ingest.ts`

**Channel config** — hardcoded list, expandable without logic changes:

```typescript
const CHANNELS: Array<{ name: string; id: string }> = [
  { name: "Tolarian Community College", id: "UCBTbckqcj4JLxAXKNMzrtZQ" },
  { name: "The Mana Traders",           id: "UCpZCNYMXJI_ptSBD3t47NOQ" },
  { name: "Alpha Investments (Rudy)",   id: "UCmI_pLG0BVNTY5n-PiDVbig" },
  { name: "MTGGoldfish",                id: "UCZAzmjqpSncHs_Ci5PJo_Ig" },
  { name: "Strictly Better MTG",        id: "UCpREVHqGO8jGjnrSbQZBfJw" },
];
```

**RSS fetch** — each channel's feed is at:
`https://www.youtube.com/feeds/videos.xml?channel_id={id}`

Returns the 15 most recent videos with: video ID, title, published date, channel name.

**Transcript fetch** — via `youtube-transcript` npm package:
```typescript
import { YoutubeTranscript } from "youtube-transcript";
const transcript = await YoutubeTranscript.fetchTranscript(videoId);
```
Transcripts are joined into a single string with space separators. Videos without captions are skipped silently.

**Deduplication** — video IDs tracked in a `Set<string>` within the run to prevent duplicates if a video appears in both RSS feeds (unlikely but safe).

**Output** — array of objects matching the `AnalysisInput` interface:
```typescript
{
  content: transcript,
  source_type: "youtube",
  source_url: `https://youtube.com/watch?v=${videoId}`,
  source_title: title,
  published_at: publishedDate.toISOString(),
  score: undefined, // always triggers Claude in hybrid analyzer
}
```

### `app/api/ingest/youtube/route.ts`

POST endpoint, identical auth pattern to the Reddit route:

```typescript
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return 401;
  const result = await runYouTubeIngestion({
    fetchVideos: fetchYouTubeVideos,
    analyzeText: hybridAnalyze,
    storeSignals,
  });
  return NextResponse.json(result);
}
```

`runYouTubeIngestion` follows the same shape as `runRedditIngestion`:
```typescript
interface IngestResult {
  videosProcessed: number;
  signalsFound: number;
  errors: string[];
}
```

### Update `lib/ingest-reddit.ts`

Change `IngestDeps.analyzeText` to accept `HybridAnalysisInput` (which extends `AnalysisInput` with optional `score`). The orchestrator loop already has access to `post.score` and should forward it:

```typescript
// Before (in the for loop):
const signals = await deps.analyzeText({ content: post.full_text, ... });

// After:
const signals = await deps.analyzeText({ content: post.full_text, ..., score: post.score });
```

### Update `app/api/ingest/reddit/route.ts`

Swap `extractSignalsFromText` for `hybridAnalyze` — no other changes needed since score is forwarded by the orchestrator:

```typescript
analyzeText: hybridAnalyze,
```

### `lib/ingest-youtube.ts`

Orchestrator (mirrors `lib/ingest-reddit.ts`):

```typescript
interface YouTubeIngestDeps {
  fetchVideos: () => Promise<YouTubeVideo[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
}

export async function runYouTubeIngestion(deps: YouTubeIngestDeps): Promise<IngestResult>
```

---

## Vercel Cron

`vercel.json` at project root:

```json
{
  "crons": [
    {
      "path": "/api/ingest/reddit",
      "schedule": "0 8 * * *"
    },
    {
      "path": "/api/ingest/youtube",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Vercel sends a `GET` request to the path on schedule with `Authorization: Bearer <CRON_SECRET>` header. The existing `isAuthorized` helper needs to accept either `x-ingest-secret` (manual trigger) or Vercel's `Authorization: Bearer` header.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Scryfall catalog fetch fails | `hybridAnalyze` falls back to Claude for that call |
| YouTube RSS fetch fails for one channel | Skip channel, add to `errors[]`, continue |
| Video has no captions | Skip video silently (not counted in `errors[]`) |
| Transcript fetch throws | Add to `errors[]`, continue to next video |
| Claude API fails | Propagate error up to route handler → 500 response |
| Supabase insert fails | Propagate error up to route handler → 500 response |

---

## Environment Variables

No new env vars required. All existing vars continue to apply:

| Var | Used by |
|---|---|
| `ANTHROPIC_API_KEY` | Claude analysis |
| `INGEST_SECRET` | Route auth |
| `NEXT_PUBLIC_SUPABASE_URL` | Signal storage |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Signal storage |

Vercel automatically provides `CRON_SECRET` for cron job auth — no manual configuration needed.

---

## Testing

| File | What it tests |
|---|---|
| `__tests__/scryfall-catalog.test.ts` | Cache behavior, fetch failure fallback |
| `__tests__/rule-based-analysis.test.ts` | Card matching, dedup, case-insensitivity, empty text, no matches |
| `__tests__/hybrid-analysis.test.ts` | Tier selection (score threshold), YouTube always-Claude, Scryfall fallback, DI injection |
| `__tests__/youtube-ingest.test.ts` | RSS parsing, transcript skip on missing captions, dedup by video ID |
| `__tests__/ingest-youtube.test.ts` | Orchestrator: processes videos, accumulates errors, stores only non-empty results |

All tests use Vitest + jsdom. External calls (Scryfall, YouTube RSS, `youtube-transcript`, Claude) are injected via DI or mocked.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/scryfall-catalog.ts` | Fetch + cache Scryfall card name catalog |
| Create | `lib/rule-based-analysis.ts` | Card name matching → IntelSignal[] |
| Create | `lib/hybrid-analysis.ts` | Two-tier analysis orchestrator |
| Create | `lib/youtube-ingest.ts` | YouTube RSS fetch + transcript fetch |
| Create | `lib/ingest-youtube.ts` | YouTube ingest pipeline orchestrator |
| Create | `app/api/ingest/youtube/route.ts` | POST /api/ingest/youtube endpoint |
| Modify | `lib/ingest-reddit.ts` | Change analyzeText dep to HybridAnalysisInput, forward post.score |
| Modify | `app/api/ingest/reddit/route.ts` | Swap extractSignalsFromText → hybridAnalyze |
| Create | `vercel.json` | Cron schedule for Reddit + YouTube |
| Create | `__tests__/scryfall-catalog.test.ts` | Tests |
| Create | `__tests__/rule-based-analysis.test.ts` | Tests |
| Create | `__tests__/hybrid-analysis.test.ts` | Tests |
| Create | `__tests__/youtube-ingest.test.ts` | Tests |
| Create | `__tests__/ingest-youtube.test.ts` | Tests |

---

## Out of Scope

- YouTube Data API / keyword search (requires API key, $0 budget constraint)
- Supabase schema changes (existing `intel_signals` table handles all source types)
- NotebookLM admin ingest (separate spec)
- Hot Cards leaderboard, watchlists, price alerts (Phase 3 features, later spec)
