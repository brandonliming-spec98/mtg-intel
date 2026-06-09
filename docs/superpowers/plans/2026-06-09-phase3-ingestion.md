# Phase 3 — Hybrid Analysis + YouTube Ingestion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `extractSignalsFromText` with a two-tier hybrid analyzer (rule-based always + Claude selectively), add YouTube RSS ingestion from 5 MTG channels, and wire both sources into daily Vercel cron jobs.

**Architecture:** `hybridAnalyze` is a drop-in replacement for `extractSignalsFromText` — same signature, same DI pattern. Tier 1 (rule-based) matches card names from Scryfall's catalog and runs on every post for free. Tier 2 (Claude) only runs when `source_type === "youtube"` OR Reddit `score >= 100`. YouTube ingestion fetches RSS feeds for 5 hardcoded channels, fetches transcripts via `youtube-transcript`, and stores signals through the same orchestrator/DI pipeline as Reddit.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest + jsdom, `youtube-transcript` npm package, Scryfall catalog API, Vercel cron

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `lib/scryfall-catalog.ts` | Fetch + in-memory cache Scryfall card name Set |
| Create | `lib/rule-based-analysis.ts` | Case-insensitive card name matching → IntelSignal[] |
| Create | `lib/hybrid-analysis.ts` | Two-tier analysis orchestrator with DI |
| Create | `lib/youtube-ingest.ts` | YouTube RSS fetch + transcript fetch (5 channels) |
| Create | `lib/ingest-youtube.ts` | YouTube ingest pipeline orchestrator (mirrors ingest-reddit.ts) |
| Create | `app/api/ingest/youtube/route.ts` | POST + GET /api/ingest/youtube with shared auth |
| Modify | `lib/ingest-reddit.ts` | Change analyzeText dep type; forward `score: post.score` |
| Modify | `app/api/ingest/reddit/route.ts` | Swap to hybridAnalyze; add GET handler; update isAuthorized for Bearer |
| Modify | `__tests__/api-ingest-reddit.test.ts` | Update analyzeText call assertion to include `score` field |
| Create | `vercel.json` | Cron schedules for Reddit (8am) + YouTube (9am) UTC |
| Create | `__tests__/scryfall-catalog.test.ts` | Cache behavior, fetch failure |
| Create | `__tests__/rule-based-analysis.test.ts` | Card matching, dedup, case-insensitivity, no matches |
| Create | `__tests__/hybrid-analysis.test.ts` | Tier selection, score threshold, YouTube always-Claude, Scryfall fallback |
| Create | `__tests__/youtube-ingest.test.ts` | RSS parsing, transcript join, missing captions skip, dedup |
| Create | `__tests__/ingest-youtube.test.ts` | Orchestrator: processes videos, accumulates errors, stores signals |

---

### Task 1: Scryfall Catalog Cache

**Files:**
- Create: `lib/scryfall-catalog.ts`
- Test: `__tests__/scryfall-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/scryfall-catalog.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module between tests so the module-level cache is cleared
beforeEach(() => {
  vi.resetModules();
});

describe("getCardCatalog", () => {
  it("fetches from Scryfall and returns a Set of card names", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: ["Ragavan, Nimble Pilferer", "Black Lotus", "Lightning Bolt"] }),
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    const catalog = await getCardCatalog();

    expect(fetch).toHaveBeenCalledWith("https://api.scryfall.com/catalog/card-names");
    expect(catalog).toBeInstanceOf(Set);
    expect(catalog.has("Ragavan, Nimble Pilferer")).toBe(true);
    expect(catalog.has("Black Lotus")).toBe(true);
    expect(catalog.size).toBe(3);
  });

  it("returns cached Set on second call without fetching again", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: ["Ragavan, Nimble Pilferer"] }),
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    await getCardCatalog();
    await getCardCatalog();

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("throws when Scryfall returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    await expect(getCardCatalog()).rejects.toThrow("Scryfall catalog fetch failed: 503");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/drdoom/Downloads/mtg-intel
npx vitest run __tests__/scryfall-catalog.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/scryfall-catalog'`

- [ ] **Step 3: Write implementation**

```typescript
// lib/scryfall-catalog.ts
let catalog: Set<string> | null = null;

export async function getCardCatalog(): Promise<Set<string>> {
  if (catalog) return catalog;
  const res = await fetch("https://api.scryfall.com/catalog/card-names");
  if (!res.ok) throw new Error(`Scryfall catalog fetch failed: ${res.status}`);
  const json = await res.json() as { data: string[] };
  catalog = new Set(json.data);
  return catalog;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/scryfall-catalog.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scryfall-catalog.ts __tests__/scryfall-catalog.test.ts
git commit -m "feat: add Scryfall catalog cache module"
```

---

### Task 2: Rule-Based Analysis

**Files:**
- Create: `lib/rule-based-analysis.ts`
- Test: `__tests__/rule-based-analysis.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/rule-based-analysis.test.ts
import { describe, it, expect, vi } from "vitest";
import { ruleBasedAnalyze } from "@/lib/rule-based-analysis";
import type { AnalysisInput } from "@/lib/claude-analysis";

const baseInput: AnalysisInput = {
  content: "",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Test post",
  published_at: "2026-06-09T09:00:00Z",
};

const mockCatalog = new Set(["Ragavan, Nimble Pilferer", "Black Lotus", "Lightning Bolt"]);

describe("ruleBasedAnalyze", () => {
  it("returns one signal per matched card name", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze(
      { ...baseInput, content: "Ragavan is underpriced. Also Lightning Bolt for burn." },
    );

    const names = signals.map((s) => s.card_name_raw);
    expect(names).toContain("Ragavan, Nimble Pilferer");
    expect(names).toContain("Lightning Bolt");
    expect(names).not.toContain("Black Lotus");
    expect(signals).toHaveLength(2);
  });

  it("deduplicates: only one signal per card even if mentioned twice", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze({
      ...baseInput,
      content: "Lightning Bolt is great. Lightning Bolt wins games.",
    });

    expect(signals).toHaveLength(1);
    expect(signals[0].card_name_raw).toBe("Lightning Bolt");
  });

  it("matches case-insensitively", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze({ ...baseInput, content: "BLACK LOTUS is busted." });
    expect(signals).toHaveLength(1);
    expect(signals[0].card_name_raw).toBe("Black Lotus");
  });

  it("returns empty array when no cards match", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze({ ...baseInput, content: "Nothing about any MTG cards here." });
    expect(signals).toEqual([]);
  });

  it("sets sentiment to neutral and signal_strength to 3", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze({ ...baseInput, content: "Ragavan is around." });
    expect(signals[0].sentiment).toBe("neutral");
    expect(signals[0].signal_strength).toBe(3);
    expect(signals[0].summary).toBe("Card mentioned in source");
  });

  it("sets source fields from input", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze({ ...baseInput, content: "Lightning Bolt rocks." });
    expect(signals[0].source_type).toBe("reddit");
    expect(signals[0].source_url).toBe(baseInput.source_url);
    expect(signals[0].source_title).toBe(baseInput.source_title);
    expect(signals[0].published_at).toBe(baseInput.published_at);
    expect(signals[0].id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/rule-based-analysis.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/rule-based-analysis'`

- [ ] **Step 3: Write implementation**

```typescript
// lib/rule-based-analysis.ts
import { getCardCatalog } from "@/lib/scryfall-catalog";
import type { AnalysisInput } from "@/lib/claude-analysis";
import type { IntelSignal } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ruleBasedAnalyze(input: AnalysisInput): Promise<IntelSignal[]> {
  const catalog = await getCardCatalog();
  const lowerContent = input.content.toLowerCase();
  const seen = new Set<string>();
  const signals: IntelSignal[] = [];

  for (const name of catalog) {
    if (seen.has(name)) continue;
    if (lowerContent.includes(name.toLowerCase())) {
      seen.add(name);
      signals.push({
        id: generateId(),
        card_name_raw: name,
        source_type: input.source_type,
        source_url: input.source_url,
        source_title: input.source_title,
        sentiment: "neutral",
        signal_strength: 3,
        summary: "Card mentioned in source",
        published_at: input.published_at,
      });
    }
  }

  return signals;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/rule-based-analysis.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rule-based-analysis.ts __tests__/rule-based-analysis.test.ts
git commit -m "feat: add rule-based card name analysis"
```

---

### Task 3: Hybrid Analysis Engine

**Files:**
- Create: `lib/hybrid-analysis.ts`
- Test: `__tests__/hybrid-analysis.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/hybrid-analysis.test.ts
import { describe, it, expect, vi } from "vitest";
import { hybridAnalyze } from "@/lib/hybrid-analysis";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { IntelSignal } from "@/types";

const makeSignal = (overrides: Partial<IntelSignal> = {}): IntelSignal => ({
  id: "sig-1",
  card_name_raw: "Ragavan, Nimble Pilferer",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Test",
  sentiment: "bullish",
  signal_strength: 8,
  summary: "Underpriced",
  published_at: "2026-06-09T09:00:00Z",
  ...overrides,
});

const baseInput: HybridAnalysisInput = {
  content: "Ragavan is cheap right now.",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Ragavan post",
  published_at: "2026-06-09T09:00:00Z",
};

const ruleSignal = makeSignal({ sentiment: "neutral", signal_strength: 3, summary: "Card mentioned in source" });
const claudeSignal = makeSignal({ sentiment: "bullish", signal_strength: 9 });

describe("hybridAnalyze", () => {
  it("uses only rule-based for Reddit posts with score < 100", async () => {
    const ruleBased = vi.fn().mockResolvedValue([ruleSignal]);
    const claude = vi.fn().mockResolvedValue([claudeSignal]);

    const signals = await hybridAnalyze(
      { ...baseInput, score: 50 },
      { ruleBased, claude }
    );

    expect(ruleBased).toHaveBeenCalledOnce();
    expect(claude).not.toHaveBeenCalled();
    expect(signals).toEqual([ruleSignal]);
  });

  it("uses Claude for Reddit posts with score >= 100, overrides rule-based", async () => {
    const ruleBased = vi.fn().mockResolvedValue([ruleSignal]);
    const claude = vi.fn().mockResolvedValue([claudeSignal]);

    const signals = await hybridAnalyze(
      { ...baseInput, score: 150 },
      { ruleBased, claude }
    );

    expect(ruleBased).toHaveBeenCalledOnce();
    expect(claude).toHaveBeenCalledOnce();
    expect(signals).toEqual([claudeSignal]);
  });

  it("always uses Claude for YouTube source regardless of score", async () => {
    const ruleBased = vi.fn().mockResolvedValue([ruleSignal]);
    const claude = vi.fn().mockResolvedValue([claudeSignal]);

    const signals = await hybridAnalyze(
      { ...baseInput, source_type: "youtube", score: undefined },
      { ruleBased, claude }
    );

    expect(claude).toHaveBeenCalledOnce();
    expect(signals).toEqual([claudeSignal]);
  });

  it("falls back to Claude when Scryfall catalog fetch fails", async () => {
    const ruleBased = vi.fn().mockRejectedValue(new Error("Scryfall catalog fetch failed: 503"));
    const claude = vi.fn().mockResolvedValue([claudeSignal]);

    const signals = await hybridAnalyze(
      { ...baseInput, score: 10 },
      { ruleBased, claude }
    );

    expect(claude).toHaveBeenCalledOnce();
    expect(signals).toEqual([claudeSignal]);
  });

  it("returns empty array when neither tier produces signals", async () => {
    const ruleBased = vi.fn().mockResolvedValue([]);
    const claude = vi.fn().mockResolvedValue([]);

    const signals = await hybridAnalyze(
      { ...baseInput, score: 200 },
      { ruleBased, claude }
    );

    expect(signals).toEqual([]);
  });

  it("passes the full input to both rule-based and claude", async () => {
    const ruleBased = vi.fn().mockResolvedValue([]);
    const claude = vi.fn().mockResolvedValue([]);
    const input: HybridAnalysisInput = { ...baseInput, score: 150 };

    await hybridAnalyze(input, { ruleBased, claude });

    expect(ruleBased).toHaveBeenCalledWith(input);
    expect(claude).toHaveBeenCalledWith(input);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/hybrid-analysis.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/hybrid-analysis'`

- [ ] **Step 3: Write implementation**

```typescript
// lib/hybrid-analysis.ts
import { extractSignalsFromText, type AnalysisInput } from "@/lib/claude-analysis";
import { ruleBasedAnalyze } from "@/lib/rule-based-analysis";
import type { IntelSignal } from "@/types";

export interface HybridAnalysisInput extends AnalysisInput {
  score?: number;
}

type ClaudeAnalyzer = (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
type RuleAnalyzer = (input: HybridAnalysisInput) => Promise<IntelSignal[]>;

interface HybridDeps {
  claude?: ClaudeAnalyzer;
  ruleBased?: RuleAnalyzer;
}

function shouldRunClaude(input: HybridAnalysisInput): boolean {
  if (input.source_type === "youtube") return true;
  if (input.source_type === "reddit" && (input.score ?? 0) >= 100) return true;
  return false;
}

export async function hybridAnalyze(
  input: HybridAnalysisInput,
  deps: HybridDeps = {}
): Promise<IntelSignal[]> {
  const claudeFn = deps.claude ?? ((i) => extractSignalsFromText(i));
  const ruleFn = deps.ruleBased ?? ruleBasedAnalyze;

  let ruleResults: IntelSignal[] = [];
  let catalogFailed = false;

  try {
    ruleResults = await ruleFn(input);
  } catch {
    catalogFailed = true;
  }

  if (catalogFailed || shouldRunClaude(input)) {
    return claudeFn(input);
  }

  return ruleResults;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/hybrid-analysis.test.ts
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/hybrid-analysis.ts __tests__/hybrid-analysis.test.ts
git commit -m "feat: add hybrid two-tier analysis engine"
```

---

### Task 4: YouTube RSS + Transcript Fetcher

**Files:**
- Install: `youtube-transcript` npm package
- Create: `lib/youtube-ingest.ts`
- Test: `__tests__/youtube-ingest.test.ts`

- [ ] **Step 1: Install the package**

```bash
cd /Users/drdoom/Downloads/mtg-intel
npm install youtube-transcript
```

Verify it's in `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

```typescript
// __tests__/youtube-ingest.test.ts
import { describe, it, expect, vi } from "vitest";
import { fetchYouTubeVideos } from "@/lib/youtube-ingest";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <title>MTG Finance Update: Top Buys</title>
    <published>2026-06-09T10:00:00+00:00</published>
    <author><name>Tolarian Community College</name></author>
  </entry>
  <entry>
    <yt:videoId>def456</yt:videoId>
    <title>Should You Buy Into This Commander Staple?</title>
    <published>2026-06-08T10:00:00+00:00</published>
    <author><name>Tolarian Community College</name></author>
  </entry>
</feed>`;

describe("fetchYouTubeVideos", () => {
  it("fetches RSS for all channels and returns videos with transcript content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "Hello welcome to this video", duration: 3.5, offset: 0 },
          { text: "today we talk about Ragavan", duration: 3.5, offset: 3.5 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    // 5 channels × 2 entries each = 10 videos total
    expect(videos.length).toBeGreaterThan(0);
    const first = videos[0];
    expect(first.source_type).toBe("youtube");
    expect(first.source_url).toMatch(/youtube\.com\/watch\?v=/);
    expect(first.content).toContain("Hello welcome");
    expect(first.content).toContain("today we talk about Ragavan");
  });

  it("skips videos where transcript fetch throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockRejectedValue(new Error("No captions available")),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    expect(videos).toHaveLength(0);
  });

  it("deduplicates videos that appear in multiple channel feeds", async () => {
    // Two channels return the same video ID
    const rssWithSameId = SAMPLE_RSS.replace("def456", "abc123");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssWithSameId),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "content", duration: 1, offset: 0 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    const ids = videos.map((v) => v.source_url);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("skips channels where RSS fetch fails and continues with others", async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS),
      } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "transcript text", duration: 1, offset: 0 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    // Should not throw even if one channel fails
    const videos = await fetch_();
    expect(Array.isArray(videos)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run __tests__/youtube-ingest.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/youtube-ingest'`

- [ ] **Step 4: Write implementation**

```typescript
// lib/youtube-ingest.ts
import { YoutubeTranscript } from "youtube-transcript";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";

const CHANNELS = [
  { name: "Tolarian Community College", id: "UCBTbckqcj4JLxAXKNMzrtZQ" },
  { name: "The Mana Traders",           id: "UCpZCNYMXJI_ptSBD3t47NOQ" },
  { name: "Alpha Investments (Rudy)",   id: "UCmI_pLG0BVNTY5n-PiDVbig" },
  { name: "MTGGoldfish",                id: "UCZAzmjqpSncHs_Ci5PJo_Ig" },
  { name: "Strictly Better MTG",        id: "UCpREVHqGO8jGjnrSbQZBfJw" },
] as const;

interface RssEntry {
  videoId: string;
  title: string;
  published: string;
  channelName: string;
}

function parseRssEntries(xml: string, channelName: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const block = match[1];
    const videoId = (block.match(/<yt:videoId>(.*?)<\/yt:videoId>/) ?? [])[1];
    const rawTitle = (block.match(/<title>(.*?)<\/title>/) ?? [])[1] ?? "";
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const published = (block.match(/<published>(.*?)<\/published>/) ?? [])[1];

    if (videoId && title && published) {
      entries.push({ videoId, title, published, channelName });
    }
  }

  return entries;
}

export async function fetchYouTubeVideos(): Promise<HybridAnalysisInput[]> {
  const seen = new Set<string>();
  const results: HybridAnalysisInput[] = [];

  for (const channel of CHANNELS) {
    let xml: string;
    try {
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`
      );
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue;
    }

    const entries = parseRssEntries(xml, channel.name);

    for (const entry of entries) {
      if (seen.has(entry.videoId)) continue;
      seen.add(entry.videoId);

      let transcript: string;
      try {
        const segments = await YoutubeTranscript.fetchTranscript(entry.videoId);
        transcript = segments.map((s) => s.text).join(" ");
      } catch {
        continue;
      }

      results.push({
        content: transcript,
        source_type: "youtube",
        source_url: `https://youtube.com/watch?v=${entry.videoId}`,
        source_title: `${entry.channelName}: ${entry.title}`,
        published_at: new Date(entry.published).toISOString(),
      });
    }
  }

  return results;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run __tests__/youtube-ingest.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/youtube-ingest.ts __tests__/youtube-ingest.test.ts package.json package-lock.json
git commit -m "feat: add YouTube RSS + transcript fetcher"
```

---

### Task 5: YouTube Ingest Orchestrator + API Route

**Files:**
- Create: `lib/ingest-youtube.ts`
- Create: `app/api/ingest/youtube/route.ts`
- Test: `__tests__/ingest-youtube.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/ingest-youtube.test.ts
import { describe, it, expect, vi } from "vitest";
import { runYouTubeIngestion, type YouTubeIngestResult } from "@/lib/ingest-youtube";
import type { IntelSignal } from "@/types";

const makeSignal = (overrides: Partial<IntelSignal> = {}): IntelSignal => ({
  id: "sig-1",
  card_name_raw: "Ragavan, Nimble Pilferer",
  source_type: "youtube",
  source_url: "https://youtube.com/watch?v=abc123",
  source_title: "Tolarian Community College: MTG Finance Update",
  sentiment: "bullish",
  signal_strength: 8,
  summary: "Underpriced for its power level",
  published_at: "2026-06-09T10:00:00Z",
  ...overrides,
});

const makeVideo = () => ({
  content: "Ragavan is a great buy right now at this price point.",
  source_type: "youtube" as const,
  source_url: "https://youtube.com/watch?v=abc123",
  source_title: "Tolarian Community College: MTG Finance Update",
  published_at: "2026-06-09T10:00:00Z",
});

describe("runYouTubeIngestion", () => {
  it("returns videosProcessed count and signalsFound", async () => {
    const signals = [makeSignal()];
    const result = await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.videosProcessed).toBe(1);
    expect(result.signalsFound).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("calls analyzeText with video content and metadata", async () => {
    const analyzeText = vi.fn().mockResolvedValue([]);
    const video = makeVideo();

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([video]),
      analyzeText,
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(analyzeText).toHaveBeenCalledWith(video);
  });

  it("calls storeSignals once with all signals from all videos", async () => {
    const storeSignals = vi.fn().mockResolvedValue(undefined);
    const signals = [makeSignal()];

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo(), makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals,
    });

    expect(storeSignals).toHaveBeenCalledOnce();
    expect(storeSignals.mock.calls[0][0]).toHaveLength(2);
  });

  it("does not call storeSignals when no signals found", async () => {
    const storeSignals = vi.fn().mockResolvedValue(undefined);

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue([]),
      storeSignals,
    });

    expect(storeSignals).not.toHaveBeenCalled();
  });

  it("records error and continues when analyzeText throws for a video", async () => {
    const result = await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockRejectedValue(new Error("Claude rate limit")),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("abc123");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/ingest-youtube.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/ingest-youtube'`

- [ ] **Step 3: Write implementation**

```typescript
// lib/ingest-youtube.ts
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { IntelSignal } from "@/types";

export interface YouTubeIngestResult {
  videosProcessed: number;
  signalsFound: number;
  errors: string[];
}

interface YouTubeIngestDeps {
  fetchVideos: () => Promise<HybridAnalysisInput[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
}

export async function runYouTubeIngestion(deps: YouTubeIngestDeps): Promise<YouTubeIngestResult> {
  const videos = await deps.fetchVideos();
  const allSignals: IntelSignal[] = [];
  const errors: string[] = [];

  for (const video of videos) {
    const videoId = video.source_url.split("v=")[1] ?? video.source_url;
    try {
      const signals = await deps.analyzeText(video);
      allSignals.push(...signals);
    } catch (err) {
      errors.push(`${videoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allSignals.length > 0) {
    await deps.storeSignals(allSignals);
  }

  return {
    videosProcessed: videos.length,
    signalsFound: allSignals.length,
    errors,
  };
}
```

```typescript
// app/api/ingest/youtube/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runYouTubeIngestion } from "@/lib/ingest-youtube";
import { fetchYouTubeVideos } from "@/lib/youtube-ingest";
import { hybridAnalyze } from "@/lib/hybrid-analysis";
import { storeSignals } from "@/lib/supabase-signals";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-ingest-secret");
  const bearer = req.headers.get("authorization");
  const expected = process.env.INGEST_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!expected) return true;
  if (secret === expected) return true;
  if (cronSecret && bearer === `Bearer ${cronSecret}`) return true;
  return false;
}

async function ingest() {
  return runYouTubeIngestion({
    fetchVideos: fetchYouTubeVideos,
    analyzeText: hybridAnalyze,
    storeSignals,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run __tests__/ingest-youtube.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/ingest-youtube.ts app/api/ingest/youtube/route.ts __tests__/ingest-youtube.test.ts
git commit -m "feat: add YouTube ingest orchestrator and API route"
```

---

### Task 6: Update Reddit Pipeline

**Files:**
- Modify: `lib/ingest-reddit.ts` — change `analyzeText` dep type; forward `score: post.score`
- Modify: `app/api/ingest/reddit/route.ts` — swap to `hybridAnalyze`; add GET cron handler; update `isAuthorized`
- Modify: `__tests__/api-ingest-reddit.test.ts` — add `score` to the `analyzeText` call assertion

- [ ] **Step 1: Update the existing test to expect `score`**

In `__tests__/api-ingest-reddit.test.ts`, find the test `"calls analyzeText with full_text and correct metadata"` and update the `toHaveBeenCalledWith` assertion to include `score`:

```typescript
// Before:
expect(analyzeText).toHaveBeenCalledWith({
  content: post.full_text,
  source_type: "reddit",
  source_url: post.url,
  source_title: post.title,
  published_at: expect.any(String),
});

// After:
expect(analyzeText).toHaveBeenCalledWith({
  content: post.full_text,
  source_type: "reddit",
  source_url: post.url,
  source_title: post.title,
  published_at: expect.any(String),
  score: post.score,
});
```

- [ ] **Step 2: Run existing tests to verify the updated test now fails (confirms it checks score)**

```bash
npx vitest run __tests__/api-ingest-reddit.test.ts
```

Expected: The "calls analyzeText with full_text and correct metadata" test FAILS (score not yet forwarded).

- [ ] **Step 3: Update `lib/ingest-reddit.ts`**

Replace the `IngestDeps` interface and the `analyzeText` call to forward `score`:

```typescript
// lib/ingest-reddit.ts
import type { IntelSignal } from "@/types";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { RedditPost } from "@/lib/reddit-ingest";

interface IngestDeps {
  fetchPosts: (subreddits?: string[]) => Promise<RedditPost[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
}

export interface IngestResult {
  postsProcessed: number;
  signalsFound: number;
  errors: string[];
}

export async function runRedditIngestion(deps: IngestDeps): Promise<IngestResult> {
  const posts = await deps.fetchPosts();
  const allSignals: IntelSignal[] = [];
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const signals = await deps.analyzeText({
        content: post.full_text,
        source_type: "reddit",
        source_url: post.url,
        source_title: post.title,
        published_at: post.created_utc.toISOString(),
        score: post.score,
      });
      allSignals.push(...signals);
    } catch (err) {
      errors.push(`${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allSignals.length > 0) {
    await deps.storeSignals(allSignals);
  }

  return {
    postsProcessed: posts.length,
    signalsFound: allSignals.length,
    errors,
  };
}
```

- [ ] **Step 4: Update `app/api/ingest/reddit/route.ts`**

```typescript
// app/api/ingest/reddit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { runRedditIngestion } from "@/lib/ingest-reddit";
import { fetchRedditPosts } from "@/lib/reddit-ingest";
import { hybridAnalyze } from "@/lib/hybrid-analysis";
import { storeSignals } from "@/lib/supabase-signals";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-ingest-secret");
  const bearer = req.headers.get("authorization");
  const expected = process.env.INGEST_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!expected) return true;
  if (secret === expected) return true;
  if (cronSecret && bearer === `Bearer ${cronSecret}`) return true;
  return false;
}

async function ingest() {
  return runRedditIngestion({
    fetchPosts: fetchRedditPosts,
    analyzeText: hybridAnalyze,
    storeSignals,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Run all existing Reddit tests to verify they pass**

```bash
npx vitest run __tests__/api-ingest-reddit.test.ts
```

Expected: PASS (all tests, including the updated score assertion)

- [ ] **Step 6: Run the full test suite to catch regressions**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add lib/ingest-reddit.ts app/api/ingest/reddit/route.ts __tests__/api-ingest-reddit.test.ts
git commit -m "feat: update Reddit pipeline to use hybridAnalyze and forward post score"
```

---

### Task 7: Vercel Cron Config

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Create `vercel.json` at project root**

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

- [ ] **Step 2: Verify the file is valid JSON**

```bash
node -e "require('./vercel.json'); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Run the full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel cron jobs for Reddit (8am) and YouTube (9am) UTC"
```

---

## Post-Implementation Checklist

After all tasks are complete, verify:

- [ ] `npx vitest run` — all tests pass
- [ ] New files exist: `lib/scryfall-catalog.ts`, `lib/rule-based-analysis.ts`, `lib/hybrid-analysis.ts`, `lib/youtube-ingest.ts`, `lib/ingest-youtube.ts`, `app/api/ingest/youtube/route.ts`, `vercel.json`
- [ ] `lib/ingest-reddit.ts` imports from `@/lib/hybrid-analysis` (not `@/lib/claude-analysis`)
- [ ] `app/api/ingest/reddit/route.ts` uses `hybridAnalyze` and has a `GET` handler
- [ ] `app/api/ingest/youtube/route.ts` has both `POST` and `GET` handlers
- [ ] `youtube-transcript` is in `package.json` dependencies
