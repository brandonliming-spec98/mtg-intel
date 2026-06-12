# Watchlist, Push Notifications & Ban-Risk Badges — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ban-risk badges to the intel feed, a per-printing watchlist with owned/watching status, and Web Push notifications for 5 trigger conditions on watched cards.

**Architecture:** Three independent phases in dependency order. Ban-risk badges are a server-side enrichment join on `/api/intel`. The watchlist is localStorage-backed behind a `useWatchlist()` hook — the hook interface never changes even when Supabase Auth is added later. Push notifications use VAPID Web Push: a `usePushNotifications` hook subscribes the browser, `/api/push/subscribe` stores the subscription in Supabase, and a Vercel cron at `/api/push/notify` checks all 5 trigger conditions hourly.

**Tech Stack:** Next.js 19 App Router, Supabase, vitest/jsdom, `web-push` npm package, service worker

---

## Files Touched

### Phase 1 — Ban-Risk Badges
| File | Action |
|---|---|
| `types/index.ts` | Modify: add `ban_risk?: number` to `IntelSignal` |
| `app/api/intel/route.ts` | Modify: enrich signals with ban_risk from card_mechanics |
| `components/SignalCard.tsx` | Modify: render ban-risk badge when `ban_risk > 0.75` |
| `__tests__/api-intel-ban-risk.test.ts` | Create: route enrichment tests |

### Phase 2 — Watchlist
| File | Action |
|---|---|
| `types/index.ts` | Modify: add `WatchlistEntry` interface |
| `hooks/useWatchlist.ts` | Create: localStorage-backed hook |
| `components/WatchlistModal.tsx` | Create: printing picker + status toggle modal |
| `components/WatchButton.tsx` | Create: ★/☆ button that opens WatchlistModal |
| `components/HotCardRow.tsx` | Create: client HotCardRow extracted from hot/page.tsx |
| `app/watchlist/page.tsx` | Create: /watchlist page |
| `components/NavBar.tsx` | Modify: add Watchlist link |
| `app/cards/[id]/page.tsx` | Modify: add WatchButton in price/action area |
| `app/hot/page.tsx` | Modify: import HotCardRow from new component file |
| `__tests__/use-watchlist.test.ts` | Create: hook unit tests |

### Phase 3 — Push Notifications
| File | Action |
|---|---|
| `supabase/migrations/002_push_subscriptions.sql` | Create: push_subscriptions table |
| `public/sw.js` | Create: service worker push handler |
| `hooks/usePushNotifications.ts` | Create: SW registration + subscribe hook |
| `components/PushInit.tsx` | Create: client wrapper to mount in layout |
| `app/api/push/subscribe/route.ts` | Create: store subscription in Supabase |
| `app/api/push/sync-watchlist/route.ts` | Create: write watchlist JSON to Supabase row |
| `lib/push-triggers.ts` | Create: check 5 trigger conditions |
| `app/api/push/notify/route.ts` | Create: hourly cron, fire pushes |
| `app/layout.tsx` | Modify: add `<PushInit />` |
| `hooks/useWatchlist.ts` | Modify: call sync-watchlist on add/remove/toggle |
| `vercel.json` | Modify: add /api/push/notify hourly cron |
| `__tests__/push-triggers.test.ts` | Create: trigger logic tests |

---

## Phase 1: Ban-Risk Badges

### Task 1: Extend IntelSignal type and write the enrichment test

**Files:**
- Modify: `types/index.ts`
- Create: `__tests__/api-intel-ban-risk.test.ts`

- [ ] **Step 1: Add `ban_risk` to IntelSignal in `types/index.ts`**

Find the `IntelSignal` interface (around line 130) and add the optional field:

```typescript
export interface IntelSignal {
  id: string;
  card_name_raw: string;
  source_type: "youtube" | "reddit" | "news" | "mtggoldfish";
  source_url: string;
  source_title: string;
  sentiment: "bullish" | "bearish" | "neutral";
  signal_type?: SignalType;
  sell_window?: string | null;
  signal_strength: number;
  summary: string;
  published_at: string;
  ban_risk?: number;       // ← add this line
}
```

- [ ] **Step 2: Write the failing enrichment test**

Create `__tests__/api-intel-ban-risk.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichWithBanRisk } from "@/app/api/intel/enrich";

const makeSignal = (card_name_raw: string) => ({
  id: "1",
  card_name_raw,
  source_type: "reddit" as const,
  source_url: "",
  source_title: "",
  sentiment: "bullish" as const,
  signal_strength: 7,
  summary: "",
  published_at: "2026-06-11T00:00:00Z",
});

const makeClient = (mechanics: { card_name: string; ban_risk: number }[]) => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: mechanics, error: null }),
    }),
  }),
});

describe("enrichWithBanRisk", () => {
  it("attaches ban_risk to signals whose card_name matches card_mechanics", async () => {
    const client = makeClient([{ card_name: "Ragavan, Nimble Pilferer", ban_risk: 0.82 }]);
    const signals = [makeSignal("Ragavan, Nimble Pilferer"), makeSignal("Llanowar Elves")];

    const result = await enrichWithBanRisk(signals, client as never);

    expect(result[0].ban_risk).toBe(0.82);
    expect(result[1].ban_risk).toBeUndefined();
  });

  it("returns signals unchanged when card_mechanics is empty", async () => {
    const client = makeClient([]);
    const signals = [makeSignal("Ragavan, Nimble Pilferer")];

    const result = await enrichWithBanRisk(signals, client as never);

    expect(result[0].ban_risk).toBeUndefined();
  });

  it("returns empty array unchanged", async () => {
    const client = makeClient([]);
    const result = await enrichWithBanRisk([], client as never);
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test — confirm it fails**

```bash
cd "/Users/drdoom/Library/CloudStorage/OneDrive-Personal/Coding Projects/mtg-intel"
npx vitest run __tests__/api-intel-ban-risk.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/intel/enrich'`

---

### Task 2: Implement enrichWithBanRisk and update the route

**Files:**
- Create: `app/api/intel/enrich.ts`
- Modify: `app/api/intel/route.ts`

- [ ] **Step 1: Create `app/api/intel/enrich.ts`**

```typescript
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { IntelSignal } from "@/types";

type Client = Pick<SupabaseClient, "from">;

function getDefaultClient(): Client {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function enrichWithBanRisk(
  signals: IntelSignal[],
  client: Client = getDefaultClient()
): Promise<IntelSignal[]> {
  if (signals.length === 0) return signals;

  const names = [...new Set(signals.map((s) => s.card_name_raw))];
  const { data } = await client
    .from("card_mechanics")
    .select("card_name, ban_risk")
    .in("card_name", names);

  const banRiskMap = new Map<string, number>(
    (data ?? []).map((m: { card_name: string; ban_risk: number }) => [m.card_name, m.ban_risk])
  );

  return signals.map((s) => {
    const br = banRiskMap.get(s.card_name_raw);
    return br !== undefined ? { ...s, ban_risk: br } : s;
  });
}
```

- [ ] **Step 2: Update `app/api/intel/route.ts` to call enrichWithBanRisk**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { fetchSignals } from "@/lib/supabase-signals";
import { enrichWithBanRisk } from "./enrich";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardName = searchParams.get("card") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  try {
    const signals = await fetchSignals({ cardName, limit });
    const enriched = await enrichWithBanRisk(signals);
    return NextResponse.json(enriched, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 3: Run test — confirm it passes**

```bash
npx vitest run __tests__/api-intel-ban-risk.test.ts
```

Expected: PASS (3 tests)

---

### Task 3: Render the ban-risk badge in SignalCard

**Files:**
- Modify: `components/SignalCard.tsx`

- [ ] **Step 1: Add the ban_risk badge to the badge row in SignalCard**

In `components/SignalCard.tsx`, find the Badges section (around line 143). Add the ban-risk badge after the momentum badge:

```tsx
{/* Badges */}
<div className="flex items-center gap-1.5 mt-2 flex-wrap">
  <span
    className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
    style={{
      color: sentimentColor,
      background: `${sentimentColor}18`,
      borderColor: `${sentimentColor}40`,
    }}
  >
    {sentimentLabel}
  </span>
  {momentumScore !== undefined && (
    <span
      className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
      style={{
        color: "#a855f7",
        background: "#a855f718",
        borderColor: "#a855f740",
      }}
    >
      ◆ {momentumScore} momentum
    </span>
  )}
  {signal.ban_risk !== undefined && signal.ban_risk > 0.75 && (
    <span
      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
      style={{
        color: "#f97316",
        background: "#f9731618",
        borderColor: "#f9731640",
      }}
    >
      ⚠ BAN RISK
    </span>
  )}
</div>
```

- [ ] **Step 2: Run full test suite — confirm nothing broke**

```bash
npx vitest run
```

Expected: all previously-passing tests still pass.

- [ ] **Step 3: Commit Phase 1**

```bash
git add types/index.ts app/api/intel/enrich.ts app/api/intel/route.ts components/SignalCard.tsx __tests__/api-intel-ban-risk.test.ts
git commit -m "feat: add ban-risk badge to intel feed (ban_risk > 0.75 from card_mechanics)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: Watchlist

### Task 4: WatchlistEntry type + useWatchlist hook

**Files:**
- Modify: `types/index.ts`
- Create: `hooks/useWatchlist.ts`
- Create: `__tests__/use-watchlist.test.ts`

- [ ] **Step 1: Add WatchlistEntry to `types/index.ts`**

Append after the `MechanicsProfile` interface at the bottom of `types/index.ts`:

```typescript
// ── Watchlist ────────────────────────────────────────────────────────────────

export type WatchlistFinish = "nonfoil" | "foil" | "etched";
export type WatchlistStatus = "watching" | "owned";

export interface WatchlistEntry {
  id: string;              // Scryfall card id — unique per printing+finish combo
  card_name: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  finish: WatchlistFinish;
  image_uri: string;
  status: WatchlistStatus;
  added_at: string;        // ISO 8601
}
```

- [ ] **Step 2: Write failing useWatchlist tests**

Create `__tests__/use-watchlist.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/types";

const makeEntry = (id: string, status: WatchlistEntry["status"] = "watching"): WatchlistEntry => ({
  id,
  card_name: "Ragavan, Nimble Pilferer",
  set_code: "mh2",
  set_name: "Modern Horizons 2",
  collector_number: "138",
  finish: "nonfoil",
  image_uri: "https://cards.scryfall.io/normal/front/a/c/ragavan.jpg",
  status,
  added_at: "2026-06-11T00:00:00Z",
});

describe("useWatchlist", () => {
  beforeEach(() => localStorage.clear());

  it("starts empty", () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });

  it("adds an entry", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe("abc");
  });

  it("does not add duplicate ids", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry("abc"));
      result.current.add(makeEntry("abc"));
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it("removes an entry by id", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    act(() => result.current.remove("abc"));
    expect(result.current.entries).toEqual([]);
  });

  it("toggles status between watching and owned", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc", "watching")));
    act(() => result.current.toggleStatus("abc"));
    expect(result.current.entries[0].status).toBe("owned");
    act(() => result.current.toggleStatus("abc"));
    expect(result.current.entries[0].status).toBe("watching");
  });

  it("isWatched returns true for a known id", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    expect(result.current.isWatched("abc")).toBe(true);
    expect(result.current.isWatched("unknown")).toBe(false);
  });

  it("persists to localStorage", () => {
    const { result, unmount } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    unmount();

    const { result: result2 } = renderHook(() => useWatchlist());
    expect(result2.current.entries).toHaveLength(1);
    expect(result2.current.entries[0].id).toBe("abc");
  });
});
```

- [ ] **Step 3: Run test — confirm it fails**

```bash
npx vitest run __tests__/use-watchlist.test.ts
```

Expected: FAIL — `Cannot find module '@/hooks/useWatchlist'`

- [ ] **Step 4: Create `hooks/useWatchlist.ts`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { WatchlistEntry } from "@/types";

const STORAGE_KEY = "mtgintel_watchlist";

function readStorage(): WatchlistEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeStorage(entries: WatchlistEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export interface UseWatchlist {
  entries: WatchlistEntry[];
  add: (entry: WatchlistEntry) => void;
  remove: (id: string) => void;
  toggleStatus: (id: string) => void;
  isWatched: (id: string) => boolean;
}

export function useWatchlist(): UseWatchlist {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    setEntries(readStorage());
  }, []);

  const persist = useCallback((next: WatchlistEntry[]) => {
    setEntries(next);
    writeStorage(next);
  }, []);

  const add = useCallback(
    (entry: WatchlistEntry) => {
      setEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev;
        const next = [...prev, entry];
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const remove = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const toggleStatus = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id
            ? { ...e, status: e.status === "watching" ? "owned" : "watching" as WatchlistEntry["status"] }
            : e
        );
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const isWatched = useCallback(
    (id: string) => entries.some((e) => e.id === id),
    [entries]
  );

  return { entries, add, remove, toggleStatus, isWatched };
}
```

- [ ] **Step 5: Run test — confirm it passes**

```bash
npx vitest run __tests__/use-watchlist.test.ts
```

Expected: PASS (7 tests)

---

### Task 5: WatchlistModal component

**Files:**
- Create: `components/WatchlistModal.tsx`

- [ ] **Step 1: Create `components/WatchlistModal.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry, WatchlistFinish, WatchlistStatus } from "@/types";

interface ScryfallPrint {
  id: string;
  set_name: string;
  set: string;
  collector_number: string;
  released_at: string;
  finishes?: string[];
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

interface Props {
  cardName: string;
  defaultPrintId?: string;
  onClose: () => void;
}

function getImageUri(print: ScryfallPrint): string {
  return (
    print.image_uris?.normal ??
    print.card_faces?.[0]?.image_uris?.normal ??
    ""
  );
}

export default function WatchlistModal({ cardName, defaultPrintId, onClose }: Props) {
  const { add, isWatched } = useWatchlist();
  const [prints, setPrints] = useState<ScryfallPrint[]>([]);
  const [selectedPrintId, setSelectedPrintId] = useState(defaultPrintId ?? "");
  const [finish, setFinish] = useState<WatchlistFinish>("nonfoil");
  const [status, setStatus] = useState<WatchlistStatus>("watching");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const encoded = encodeURIComponent(`!"${cardName}"`);
    fetch(
      `https://api.scryfall.com/cards/search?q=${encoded}&unique=prints&order=released`
    )
      .then((r) => r.json())
      .then((json) => {
        const data: ScryfallPrint[] = json.data ?? [];
        setPrints(data);
        if (!defaultPrintId && data.length > 0) setSelectedPrintId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardName, defaultPrintId]);

  const selectedPrint = prints.find((p) => p.id === selectedPrintId);
  const availableFinishes = (selectedPrint?.finishes ?? ["nonfoil"]) as WatchlistFinish[];

  useEffect(() => {
    if (!availableFinishes.includes(finish)) {
      setFinish(availableFinishes[0] ?? "nonfoil");
    }
  }, [selectedPrintId]); // eslint-disable-line react-hooks/exhaustive-deps

  const entryId = `${selectedPrintId}_${finish}`;
  const alreadyWatched = isWatched(entryId);

  function handleAdd() {
    if (!selectedPrint) return;
    const year = selectedPrint.released_at?.slice(0, 4) ?? "";
    const entry: WatchlistEntry = {
      id: entryId,
      card_name: cardName,
      set_code: selectedPrint.set,
      set_name: `${selectedPrint.set_name} (${year})`,
      collector_number: selectedPrint.collector_number,
      finish,
      image_uri: getImageUri(selectedPrint),
      status,
      added_at: new Date().toISOString(),
    };
    add(entry);
    onClose();
  }

  const finishLabel: Record<WatchlistFinish, string> = {
    nonfoil: "Non-Foil",
    foil: "Foil",
    etched: "Foil Etched",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Add to Watchlist</h2>
          <p className="text-neutral text-sm mt-0.5">{cardName}</p>
        </div>

        {loading ? (
          <div className="h-10 bg-bg-elevated animate-pulse rounded-lg" />
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                Printing
              </label>
              <select
                value={selectedPrintId}
                onChange={(e) => setSelectedPrintId(e.target.value)}
                className="w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gold/50"
              >
                {prints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.set_name} ({p.released_at?.slice(0, 4)}) · #{p.collector_number}
                  </option>
                ))}
              </select>
            </div>

            {availableFinishes.length > 1 && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                  Finish
                </label>
                <div className="flex gap-2">
                  {availableFinishes.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFinish(f)}
                      className="flex-1 py-2 rounded-lg border text-xs font-mono transition-all"
                      style={
                        finish === f
                          ? { color: "#d4a843", background: "#d4a84318", borderColor: "#d4a84340" }
                          : { color: "#6b7280", background: "transparent", borderColor: "#21262d" }
                      }
                    >
                      {finishLabel[f]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                Status
              </label>
              <div className="flex gap-2">
                {(["watching", "owned"] as WatchlistStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="flex-1 py-3 rounded-lg border text-center transition-all"
                    style={
                      status === s
                        ? s === "watching"
                          ? { color: "#d4a843", background: "#d4a84318", borderColor: "#d4a84340" }
                          : { color: "#22c55e", background: "#22c55e18", borderColor: "#22c55e40" }
                        : { color: "#6b7280", background: "transparent", borderColor: "#21262d" }
                    }
                  >
                    <div className="text-lg">{s === "watching" ? "◎" : "●"}</div>
                    <div className="text-[11px] font-mono font-bold mt-1">
                      {s === "watching" ? "Watching" : "Own It"}
                    </div>
                    <div className="text-[9px] font-mono opacity-60 mt-0.5">
                      {s === "watching" ? "Monitor price" : "Track value"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-bg-border text-neutral text-sm font-mono hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPrint || alreadyWatched}
            className="flex-[2] py-2 rounded-lg text-sm font-mono font-bold transition-all disabled:opacity-40"
            style={{ background: "#d4a843", color: "#0a0a0f" }}
          >
            {alreadyWatched ? "Already Watched" : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the test suite to make sure nothing broke**

```bash
npx vitest run
```

Expected: all tests pass.

---

### Task 6: WatchButton component

**Files:**
- Create: `components/WatchButton.tsx`

- [ ] **Step 1: Create `components/WatchButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import WatchlistModal from "./WatchlistModal";
import type { WatchlistEntry } from "@/types";

interface Props {
  cardName: string;
  defaultEntry?: Omit<WatchlistEntry, "status" | "added_at">;
  className?: string;
  size?: "sm" | "md";
}

export default function WatchButton({ cardName, defaultEntry, className = "", size = "md" }: Props) {
  const { isWatched, remove } = useWatchlist();
  const [open, setOpen] = useState(false);

  const watched = defaultEntry
    ? isWatched(`${defaultEntry.id}_${defaultEntry.finish}`)
    : false;

  function handleClick() {
    if (watched && defaultEntry) {
      remove(`${defaultEntry.id}_${defaultEntry.finish}`);
    } else {
      setOpen(true);
    }
  }

  const star = watched ? "★" : "☆";
  const label = watched ? "Watching" : "Watch";
  const sizeClass = size === "sm"
    ? "text-xs px-2 py-1 gap-1"
    : "text-sm px-3 py-2 gap-2";

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center border rounded-xl font-mono transition-all ${sizeClass} ${
          watched
            ? "border-gold/40 text-gold bg-gold/10 hover:bg-gold/20"
            : "border-bg-border text-neutral hover:text-gold hover:border-gold/30"
        } ${className}`}
        title={watched ? "Remove from watchlist" : "Add to watchlist"}
      >
        <span>{star}</span>
        <span>{label}</span>
      </button>

      {open && (
        <WatchlistModal
          cardName={cardName}
          defaultPrintId={defaultEntry?.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

---

### Task 7: /watchlist page

**Files:**
- Create: `app/watchlist/page.tsx`

- [ ] **Step 1: Create `app/watchlist/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/types";

interface PriceRow {
  currentPrice: number | null;
  delta7d: number | null;
}

const FINISH_LABEL: Record<WatchlistEntry["finish"], string> = {
  nonfoil: "Non-Foil",
  foil: "Foil",
  etched: "Foil Etched",
};

function usePrices(entries: WatchlistEntry[]) {
  const [prices, setPrices] = useState<Record<string, PriceRow>>({});

  useEffect(() => {
    if (entries.length === 0) return;
    const names = [...new Set(entries.map((e) => e.card_name))];
    names.forEach((name) => {
      fetch(`/api/prices?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((data) => {
          const current: number | null = data.currentPrice ?? null;
          const history: Array<{ price: number }> = data.history ?? [];
          const weekAgo = history.length > 7 ? history[history.length - 8]?.price ?? null : null;
          const delta7d =
            current !== null && weekAgo !== null && weekAgo > 0
              ? ((current - weekAgo) / weekAgo) * 100
              : null;
          setPrices((prev) => ({ ...prev, [name]: { currentPrice: current, delta7d } }));
        })
        .catch(() => {});
    });
  }, [entries]);

  return prices;
}

function EntryRow({
  entry,
  price,
  onRemove,
  onToggle,
}: {
  entry: WatchlistEntry;
  price: PriceRow | undefined;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-3 flex gap-3 items-center relative">
      {entry.image_uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image_uri}
          alt={entry.card_name}
          className="w-8 h-11 rounded object-cover flex-shrink-0"
          style={{ border: "1px solid rgba(212,175,55,0.2)" }}
        />
      ) : (
        <div
          className="w-8 h-11 rounded flex-shrink-0 flex items-center justify-center text-sm"
          style={{
            background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
            border: "1px solid rgba(212,175,55,0.2)",
          }}
        >
          🃏
        </div>
      )}

      <div className="flex-1 min-w-0">
        <Link
          href={`/cards/${entry.id.split("_")[0]}`}
          className="text-gold font-bold text-sm hover:text-gold-light transition-colors block truncate"
        >
          {entry.card_name}
        </Link>
        <div className="text-neutral text-[10px] font-mono mt-0.5">
          {entry.set_name} · {FINISH_LABEL[entry.finish]} · #{entry.collector_number}
        </div>
      </div>

      <div className="text-right flex-shrink-0 mr-2">
        {price?.currentPrice != null ? (
          <>
            <div className="text-white font-mono font-bold text-sm">
              ${price.currentPrice.toFixed(2)}
            </div>
            {price.delta7d !== null && (
              <div
                className="text-[10px] font-mono"
                style={{ color: price.delta7d >= 0 ? "#22c55e" : "#ef4444" }}
              >
                {price.delta7d >= 0 ? "+" : ""}
                {price.delta7d.toFixed(1)}% 7d
              </div>
            )}
          </>
        ) : (
          <div className="text-neutral font-mono text-sm">—</div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-neutral hover:text-white p-1 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-7 z-10 bg-bg-card border border-bg-border rounded-xl py-1 w-40 shadow-lg"
            onBlur={() => setMenuOpen(false)}
          >
            <button
              onClick={() => { onToggle(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-neutral hover:text-white hover:bg-bg-elevated transition-all font-mono"
            >
              {entry.status === "watching" ? "Mark as Owned" : "Mark as Watching"}
            </button>
            <button
              onClick={() => { onRemove(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-bg-elevated transition-all font-mono"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const { entries, remove, toggleStatus } = useWatchlist();
  const prices = usePrices(entries);

  const owned = entries.filter((e) => e.status === "owned");
  const watching = entries.filter((e) => e.status === "watching");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bookmark size={20} className="text-gold" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Watchlist</h1>
          <p className="text-neutral text-xs font-mono mt-0.5">
            {entries.length} card{entries.length !== 1 ? "s" : ""} tracked · prices updated live
          </p>
        </div>
      </div>

      {entries.length === 0 && (
        <div className="bg-bg-card border border-bg-border rounded-2xl p-10 text-center">
          <Bookmark size={28} className="text-gold mx-auto mb-3" />
          <h3 className="font-display text-lg font-bold text-white mb-2">Nothing here yet</h3>
          <p className="text-neutral text-sm max-w-xs mx-auto">
            Use the ☆ Watch button on any card detail page or the Hot Cards dashboard to start tracking.
          </p>
          <p className="text-neutral/40 text-xs font-mono mt-4">
            iOS 16.4+ required for push notifications · Add to Home Screen
          </p>
        </div>
      )}

      {owned.length > 0 && (
        <section className="mb-8">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-green-400 mb-3">
            ● Own It ({owned.length})
          </div>
          <div className="flex flex-col gap-2">
            {owned.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                price={prices[e.card_name]}
                onRemove={() => remove(e.id)}
                onToggle={() => toggleStatus(e.id)}
              />
            ))}
          </div>
        </section>
      )}

      {watching.length > 0 && (
        <section>
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gold mb-3">
            ◎ Watching ({watching.length})
          </div>
          <div className="flex flex-col gap-2">
            {watching.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                price={prices[e.card_name]}
                onRemove={() => remove(e.id)}
                onToggle={() => toggleStatus(e.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

---

### Task 8: Wire WatchButton into NavBar, card detail page, and Hot Cards page

**Files:**
- Modify: `components/NavBar.tsx`
- Modify: `app/cards/[id]/page.tsx`
- Create: `components/HotCardRow.tsx`
- Modify: `app/hot/page.tsx`

- [ ] **Step 1: Add Watchlist to NavBar links in `components/NavBar.tsx`**

Find the `links` array and add the Watchlist entry:

```typescript
import { Search, TrendingUp, Zap, Home, Flame, Bookmark } from "lucide-react";

const links = [
  { href: "/",         label: "Home",      icon: Home },
  { href: "/search",   label: "Search",    icon: Search },
  { href: "/market",   label: "Market",    icon: TrendingUp },
  { href: "/hot",      label: "Hot Cards", icon: Flame },
  { href: "/watchlist",label: "Watchlist", icon: Bookmark },
  { href: "/intel",    label: "Intel",     icon: Zap, badge: "Soon" },
];
```

- [ ] **Step 2: Add WatchButton to card detail page**

In `app/cards/[id]/page.tsx`, add the import at the top:

```typescript
import WatchButton from "@/components/WatchButton";
```

Then find the price + signal badge section (around line 118) and add the WatchButton after the signal badge:

```tsx
{/* Price + signal badge + watch button */}
<div className="flex items-center gap-4 mb-6 flex-wrap">
  <span className="font-mono text-3xl font-bold text-white">
    {displayPrice ? `$${displayPrice.toFixed(2)}` : "—"}
  </span>
  {priceChange && priceUp !== null && (
    <span className="font-mono text-base" style={{ color: priceUp ? "#22c55e" : "#ef4444" }}>
      {priceUp ? "▲" : "▼"} {priceChange} 7d
    </span>
  )}
  {signals.length > 0 && (
    <span
      className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
      style={{
        color: bullish.length > bearish.length ? "#22c55e" : "#ef4444",
        background: bullish.length > bearish.length ? "#22c55e18" : "#ef444418",
        borderColor: bullish.length > bearish.length ? "#22c55e40" : "#ef444440",
      }}
    >
      {bullish.length > bearish.length ? "▲ BUY" : "▼ SELL"}
    </span>
  )}
  <WatchButton
    cardName={card.name}
    defaultEntry={{
      id: card.id,
      card_name: card.name,
      set_code: card.set,
      set_name: card.set_name,
      collector_number: card.collector_number,
      finish: card.foil ? "foil" : "nonfoil",
      image_uri: card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal ?? "",
    }}
  />
</div>
```

- [ ] **Step 3: Create `components/HotCardRow.tsx` (extracted client component)**

```tsx
"use client";

import WatchButton from "./WatchButton";
import type { SignalType } from "@/types";
import { Zap, TrendingDown, AlertTriangle, Tag, BarChart2 } from "lucide-react";

interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

const SIGNAL_META: Record<SignalType, { label: string; icon: React.ReactNode; color: string }> = {
  buy_hype:             { label: "Spiking",       icon: <Zap size={11} />,          color: "text-gold border-gold/30 bg-gold/10" },
  format_staple:        { label: "Format Staple", icon: <BarChart2 size={11} />,     color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  reprint_announced:    { label: "Reprint",        icon: <Tag size={11} />,           color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  price_peak:           { label: "At Peak",        icon: <TrendingDown size={11} />,  color: "text-red-400 border-red-400/30 bg-red-400/10" },
  ban_risk:             { label: "Ban Risk",       icon: <AlertTriangle size={11} />, color: "text-red-400 border-red-400/30 bg-red-400/10" },
  set_release_pressure: { label: "Set Pressure",  icon: <TrendingDown size={11} />,  color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  general:              { label: "Mentioned",      icon: <Zap size={11} />,           color: "text-neutral border-bg-border bg-bg-elevated" },
};

function SignalBadge({ type }: { type: SignalType }) {
  const meta = SIGNAL_META[type] ?? SIGNAL_META.general;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono text-neutral/60">{value.toFixed(1)}</span>
    </div>
  );
}

function SellWindowChip({ date }: { date: string }) {
  const d = new Date(date);
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const daysUntil = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const urgent = daysUntil <= 14;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
      urgent ? "text-red-400 border-red-400/40 bg-red-400/10" : "text-orange-300 border-orange-400/30 bg-orange-400/8"
    }`}>
      Sell by {formatted}{urgent && " ⚡"}
    </span>
  );
}

export function HotCardRow({ card, direction }: { card: HotCard; direction: "buy" | "sell" }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl border border-bg-border hover:border-gold/30 hover:bg-bg-elevated/50 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <a
            href={`/search?q=${encodeURIComponent(card.card_name)}`}
            className="text-sm font-bold text-text-primary truncate hover:text-gold transition-colors"
          >
            {card.card_name}
          </a>
          <SignalBadge type={card.signal_type} />
          {card.sell_window && direction === "sell" && <SellWindowChip date={card.sell_window} />}
        </div>
        {card.summaries[0] && (
          <p className="text-xs text-neutral/70 leading-relaxed line-clamp-2">{card.summaries[0]}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <StrengthBar value={card.avg_strength} />
          <span className="text-[10px] font-mono text-neutral/50">
            {card.signal_count} signal{card.signal_count !== 1 ? "s" : ""} · {new Date(card.latest_signal).toLocaleDateString()}
          </span>
        </div>
      </div>
      <WatchButton cardName={card.card_name} size="sm" />
    </div>
  );
}
```

- [ ] **Step 4: Update `app/hot/page.tsx` to use extracted HotCardRow**

Replace the top of `app/hot/page.tsx`. Remove the local `HotCardRow`, `SignalBadge`, `StrengthBar`, and `SellWindowChip` functions. Replace with an import, and update the `Section` component to use the imported `HotCardRow`:

```tsx
export const dynamic = "force-dynamic";

import { Flame, TrendingDown } from "lucide-react";
import type { SignalType } from "@/types";
import { HotCardRow } from "@/components/HotCardRow";

interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

interface HotData {
  buy: HotCard[];
  sell: HotCard[];
}

async function getHotData(): Promise<HotData> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/hot`, { next: { revalidate: 300 } });
  if (!res.ok) return { buy: [], sell: [] };
  return res.json();
}

function Section({
  title,
  icon,
  cards,
  direction,
  emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  cards: HotCard[];
  direction: "buy" | "sell";
  emptyMsg: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">{title}</h2>
        <span className="text-xs font-mono text-neutral/50 ml-auto">{cards.length} cards</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-xs text-neutral/50 py-6 text-center border border-dashed border-bg-border rounded-xl">{emptyMsg}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.slice(0, 20).map((card) => (
            <HotCardRow key={card.card_name} card={card} direction={direction} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function HotCardsPage() {
  const { buy, sell } = await getHotData();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-gold" />
          <h1 className="text-xl font-bold text-text-primary">Hot Cards</h1>
        </div>
        <p className="text-sm text-neutral/70">
          Buy and sell signals from the last 7 days — ranked by community momentum.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Section
          title="Buy Signals"
          icon={<Flame size={14} className="text-gold" />}
          cards={buy}
          direction="buy"
          emptyMsg="No strong buy signals in the last 7 days."
        />
        <Section
          title="Sell Signals"
          icon={<TrendingDown size={14} className="text-red-400" />}
          cards={sell}
          direction="sell"
          emptyMsg="No sell signals in the last 7 days."
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit Phase 2**

```bash
git add types/index.ts hooks/useWatchlist.ts components/WatchlistModal.tsx components/WatchButton.tsx components/HotCardRow.tsx app/watchlist/page.tsx components/NavBar.tsx app/cards/[id]/page.tsx app/hot/page.tsx __tests__/use-watchlist.test.ts
git commit -m "feat: add watchlist with per-printing tracking and watching/owned status

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: Push Notifications

### Task 9: Supabase migration — push_subscriptions table

**Files:**
- Create: `supabase/migrations/002_push_subscriptions.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Push subscriptions — single-user for now.
-- Multi-user path: add user_id UUID REFERENCES auth.users, add RLS policy.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription JSONB     NOT NULL,
  watchlist  JSONB       NOT NULL DEFAULT '[]',
  last_notified JSONB    NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard for project `xpdnqsxxevhbkqdjpksc`, navigate to SQL Editor, paste and run the contents of `supabase/migrations/002_push_subscriptions.sql`.

- [ ] **Step 3: Install web-push and generate VAPID keys**

```bash
cd "/Users/drdoom/Library/CloudStorage/OneDrive-Personal/Coding Projects/mtg-intel"
npm install web-push
npm install -D @types/web-push
npx web-push generate-vapid-keys
```

Copy the output. Add to `.env.local` and to Vercel project environment variables:

```
VAPID_PUBLIC_KEY=<paste public key>
VAPID_PRIVATE_KEY=<paste private key>
VAPID_SUBJECT=mailto:brandon.liming@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<paste public key — same value, needed client-side>
CRON_SECRET=<generate a random string, e.g. openssl rand -hex 32>
```

Also add `PRICE_ALERT_THRESHOLD=10` (optional, defaults to 10 in code).

---

### Task 10: Service worker and usePushNotifications hook

**Files:**
- Create: `public/sw.js`
- Create: `hooks/usePushNotifications.ts`
- Create: `components/PushInit.tsx`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create `public/sw.js`**

```javascript
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "MTG Intel", body: event.data.text() };
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "MTG Intel", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: payload.url ? { url: payload.url } : undefined,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(clients.openWindow(url));
});
```

- [ ] **Step 2: Create `hooks/usePushNotifications.ts`**

```typescript
"use client";

import { useEffect } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function usePushNotifications() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    )
      return;

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const existing = await registration.pushManager.getSubscription();
        if (existing) return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        });
      })
      .catch(() => {});
  }, []);
}
```

- [ ] **Step 3: Create `components/PushInit.tsx`**

```tsx
"use client";

import { usePushNotifications } from "@/hooks/usePushNotifications";

export default function PushInit() {
  usePushNotifications();
  return null;
}
```

- [ ] **Step 4: Add PushInit to `app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import NavBar from "@/components/NavBar";
import PushInit from "@/components/PushInit";

export const metadata: Metadata = {
  title: "MTG Intel — Magic: The Gathering Market Intelligence",
  description: "Real-time MTG card prices, market signals, and intelligence from across the web.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "MTG Intel" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="noise min-h-screen">
        <NavBar />
        <PushInit />
        <main className="pb-20 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
```

---

### Task 11: Subscribe and sync-watchlist API routes

**Files:**
- Create: `app/api/push/subscribe/route.ts`
- Create: `app/api/push/sync-watchlist/route.ts`

- [ ] **Step 1: Create `app/api/push/subscribe/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const subscription = await req.json();
  if (!subscription?.endpoint) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  const supabase = getClient();
  // Single-user: clear old subscription and insert fresh
  await supabase.from("push_subscriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await supabase
    .from("push_subscriptions")
    .insert({ subscription, watchlist: [], last_notified: {} });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

> **Note:** `SUPABASE_SERVICE_ROLE_KEY` is a server-only secret (never `NEXT_PUBLIC_`). Add it to `.env.local` and Vercel env vars. Find it in Supabase dashboard → Settings → API.

- [ ] **Step 2: Create `app/api/push/sync-watchlist/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const { watchlist } = await req.json();
  if (!Array.isArray(watchlist)) {
    return NextResponse.json({ error: "watchlist must be an array" }, { status: 400 });
  }

  const supabase = getClient();
  const { data: rows } = await supabase
    .from("push_subscriptions")
    .select("id")
    .limit(1);

  if (!rows || rows.length === 0) {
    return NextResponse.json({ ok: true, skipped: "no subscription" });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ watchlist, updated_at: new Date().toISOString() })
    .eq("id", rows[0].id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Update `hooks/useWatchlist.ts` to sync on every mutation**

Add a `syncWatchlist` call inside `add`, `remove`, and `toggleStatus`. Add this helper at the top of the module, after the `writeStorage` function:

```typescript
function syncWatchlist(entries: WatchlistEntry[]): void {
  fetch("/api/push/sync-watchlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ watchlist: entries }),
  }).catch(() => {});
}
```

Then update `add`, `remove`, and `toggleStatus` to call `syncWatchlist(next)` after `writeStorage(next)`:

```typescript
const add = useCallback((entry: WatchlistEntry) => {
  setEntries((prev) => {
    if (prev.some((e) => e.id === entry.id)) return prev;
    const next = [...prev, entry];
    writeStorage(next);
    syncWatchlist(next);
    return next;
  });
}, []);

const remove = useCallback((id: string) => {
  setEntries((prev) => {
    const next = prev.filter((e) => e.id !== id);
    writeStorage(next);
    syncWatchlist(next);
    return next;
  });
}, []);

const toggleStatus = useCallback((id: string) => {
  setEntries((prev) => {
    const next = prev.map((e) =>
      e.id === id
        ? { ...e, status: e.status === "watching" ? "owned" : "watching" as WatchlistEntry["status"] }
        : e
    );
    writeStorage(next);
    syncWatchlist(next);
    return next;
  });
}, []);
```

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. (The `syncWatchlist` fetch is a fire-and-forget; tests don't need to assert it.)

---

### Task 12: push-triggers.ts — check all 5 conditions

**Files:**
- Create: `lib/push-triggers.ts`
- Create: `__tests__/push-triggers.test.ts`

- [ ] **Step 1: Write failing tests first**

Create `__tests__/push-triggers.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { checkTriggers, type TriggerResult } from "@/lib/push-triggers";
import type { WatchlistEntry } from "@/types";

const makeEntry = (card_name: string, id = "abc123"): WatchlistEntry => ({
  id: `${id}_nonfoil`,
  card_name,
  set_code: "mh2",
  set_name: "Modern Horizons 2 (2021)",
  collector_number: "138",
  finish: "nonfoil",
  image_uri: "",
  status: "watching",
  added_at: "2026-06-11T00:00:00Z",
});

const makeSupabase = (signals: unknown[] = [], mechanics: unknown[] = []) => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ data: signals, error: null }),
      }),
      gt: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: mechanics, error: null }),
      }),
    }),
  }),
});

describe("checkTriggers", () => {
  it("returns new-signal trigger when intel_signals has recent rows for watched cards", async () => {
    const signals = [{ card_name_raw: "Ragavan, Nimble Pilferer", sentiment: "bullish", source_type: "reddit" }];
    const supabase = makeSupabase(signals);
    const lastNotified = {};

    const results = await checkTriggers(
      [makeEntry("Ragavan, Nimble Pilferer")],
      lastNotified,
      supabase as never,
      vi.fn().mockResolvedValue(null)
    );

    expect(results.some((r: TriggerResult) => r.trigger === "new_signal")).toBe(true);
  });

  it("does not re-fire a trigger notified within 24h", async () => {
    const signals = [{ card_name_raw: "Ragavan, Nimble Pilferer", sentiment: "bullish", source_type: "reddit" }];
    const supabase = makeSupabase(signals);
    const key = "abc123_nonfoil_new_signal";
    const lastNotified: Record<string, string> = {
      [key]: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
    };

    const results = await checkTriggers(
      [makeEntry("Ragavan, Nimble Pilferer")],
      lastNotified,
      supabase as never,
      vi.fn().mockResolvedValue(null)
    );

    expect(results.some((r: TriggerResult) => r.trigger === "new_signal")).toBe(false);
  });

  it("fires price_spike trigger when price rose >= threshold", async () => {
    const supabase = makeSupabase();
    const priceData = {
      currentPrice: 50,
      history: Array.from({ length: 25 }, (_, i) => ({ price: i < 24 ? 40 : 50, date: "" })),
    };

    const results = await checkTriggers(
      [makeEntry("Ragavan, Nimble Pilferer")],
      {},
      supabase as never,
      vi.fn().mockResolvedValue(priceData)
    );

    expect(results.some((r: TriggerResult) => r.trigger === "price_spike")).toBe(true);
  });

  it("fires price_drop trigger when price fell >= threshold", async () => {
    const supabase = makeSupabase();
    const priceData = {
      currentPrice: 36,
      history: Array.from({ length: 25 }, (_, i) => ({ price: i < 24 ? 40 : 36, date: "" })),
    };

    const results = await checkTriggers(
      [makeEntry("Ragavan, Nimble Pilferer")],
      {},
      supabase as never,
      vi.fn().mockResolvedValue(priceData)
    );

    expect(results.some((r: TriggerResult) => r.trigger === "price_drop")).toBe(true);
  });

  it("returns empty array when no triggers fire", async () => {
    const supabase = makeSupabase();
    const results = await checkTriggers(
      [makeEntry("Llanowar Elves")],
      {},
      supabase as never,
      vi.fn().mockResolvedValue(null)
    );
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx vitest run __tests__/push-triggers.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/push-triggers'`

- [ ] **Step 3: Create `lib/push-triggers.ts`**

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistEntry, CardPriceData } from "@/types";

export type TriggerType = "new_signal" | "price_spike" | "price_drop" | "ban_risk" | "hot_card";

export interface TriggerResult {
  entry: WatchlistEntry;
  trigger: TriggerType;
  title: string;
  body: string;
  url: string;
}

type Client = Pick<SupabaseClient, "from">;
type PriceFetcher = (name: string) => Promise<CardPriceData | null>;

const THRESHOLD_PCT = Number(process.env.PRICE_ALERT_THRESHOLD ?? "10");
const COOLDOWN_MS   = 24 * 60 * 60 * 1000;

function isDue(key: string, lastNotified: Record<string, string>): boolean {
  const last = lastNotified[key];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > COOLDOWN_MS;
}

export async function checkTriggers(
  watchlist: WatchlistEntry[],
  lastNotified: Record<string, string>,
  supabase: Client,
  fetchPrice: PriceFetcher
): Promise<TriggerResult[]> {
  if (watchlist.length === 0) return [];

  const results: TriggerResult[] = [];
  const cardNames = [...new Set(watchlist.map((e) => e.card_name))];
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour

  // ── New signal ─────────────────────────────────────────────────────────────
  const { data: newSignals } = await supabase
    .from("intel_signals")
    .select("card_name_raw, sentiment, source_type")
    .in("card_name_raw", cardNames)
    .gte("ingested_at", since);

  for (const signal of newSignals ?? []) {
    const entry = watchlist.find((e) => e.card_name === signal.card_name_raw);
    if (!entry) continue;
    const key = `${entry.id}_new_signal`;
    if (!isDue(key, lastNotified)) continue;
    results.push({
      entry,
      trigger: "new_signal",
      title: `New signal: ${entry.card_name}`,
      body: `${signal.sentiment === "bullish" ? "▲" : signal.sentiment === "bearish" ? "▼" : "—"} ${signal.sentiment} · ${signal.source_type}`,
      url: `/search?q=${encodeURIComponent(entry.card_name)}`,
    });
  }

  // ── Ban risk spike ─────────────────────────────────────────────────────────
  const { data: highRisk } = await supabase
    .from("card_mechanics")
    .select("card_name, ban_risk, ban_risk_by_format")
    .gt("ban_risk", 0.75)
    .in("card_name", cardNames);

  for (const m of highRisk ?? []) {
    const entry = watchlist.find((e) => e.card_name === m.card_name);
    if (!entry) continue;
    const key = `${entry.id}_ban_risk`;
    if (!isDue(key, lastNotified)) continue;
    const topFormat = Object.entries(m.ban_risk_by_format ?? {})
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] ?? "unknown";
    results.push({
      entry,
      trigger: "ban_risk",
      title: `⚠ Ban risk: ${entry.card_name}`,
      body: `High ban risk in ${topFormat}`,
      url: `/search?q=${encodeURIComponent(entry.card_name)}`,
    });
  }

  // ── Hot card ───────────────────────────────────────────────────────────────
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: hotSignals } = await supabase
    .from("intel_signals")
    .select("card_name_raw")
    .in("card_name_raw", cardNames)
    .gte("ingested_at", since24h);

  const signalCounts = (hotSignals ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.card_name_raw] = (acc[s.card_name_raw] ?? 0) + 1;
    return acc;
  }, {});

  for (const entry of watchlist) {
    const count = signalCounts[entry.card_name] ?? 0;
    if (count < 3) continue;
    const key = `${entry.id}_hot_card`;
    if (!isDue(key, lastNotified)) continue;
    results.push({
      entry,
      trigger: "hot_card",
      title: `${entry.card_name} is trending`,
      body: `${count} signals in recent feed`,
      url: `/hot`,
    });
  }

  // ── Price spike / drop ─────────────────────────────────────────────────────
  await Promise.all(
    watchlist.map(async (entry) => {
      const priceData = await fetchPrice(entry.card_name);
      if (!priceData?.currentPrice || priceData.history.length < 2) return;

      const current = priceData.currentPrice;
      const prev = priceData.history[Math.max(0, priceData.history.length - 2)]?.price;
      if (!prev || prev === 0) return;

      const pct = ((current - prev) / prev) * 100;

      if (pct >= THRESHOLD_PCT) {
        const key = `${entry.id}_price_spike`;
        if (!isDue(key, lastNotified)) return;
        results.push({
          entry,
          trigger: "price_spike",
          title: `${entry.card_name} up ${pct.toFixed(1)}%`,
          body: `Now $${current.toFixed(2)}`,
          url: `/search?q=${encodeURIComponent(entry.card_name)}`,
        });
      } else if (pct <= -THRESHOLD_PCT) {
        const key = `${entry.id}_price_drop`;
        if (!isDue(key, lastNotified)) return;
        results.push({
          entry,
          trigger: "price_drop",
          title: `${entry.card_name} down ${Math.abs(pct).toFixed(1)}%`,
          body: `Now $${current.toFixed(2)}`,
          url: `/search?q=${encodeURIComponent(entry.card_name)}`,
        });
      }
    })
  );

  return results;
}
```

- [ ] **Step 4: Run test — confirm it passes**

```bash
npx vitest run __tests__/push-triggers.test.ts
```

Expected: PASS (5 tests). Note: the Supabase mock chain in the test is simplified — the implementation will work correctly with the real client.

---

### Task 13: /api/push/notify cron route

**Files:**
- Create: `app/api/push/notify/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create `app/api/push/notify/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { checkTriggers } from "@/lib/push-triggers";
import { getPriceWithFallback } from "@/lib/price-sources";
import type { WatchlistEntry } from "@/types";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getClient();
  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, subscription, watchlist, last_notified")
    .limit(1);

  if (error || !rows || rows.length === 0) {
    return NextResponse.json({ ok: true, fired: 0 });
  }

  const row = rows[0];
  const watchlist: WatchlistEntry[] = row.watchlist ?? [];
  const lastNotified: Record<string, string> = row.last_notified ?? {};

  const triggers = await checkTriggers(
    watchlist,
    lastNotified,
    supabase,
    getPriceWithFallback
  );

  let fired = 0;
  const updatedNotified = { ...lastNotified };

  for (const t of triggers) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({ title: t.title, body: t.body, url: t.url })
      );
      updatedNotified[`${t.entry.id}_${t.trigger}`] = new Date().toISOString();
      fired++;
    } catch {
      // Subscription expired — clear it
      await supabase.from("push_subscriptions").delete().eq("id", row.id);
      return NextResponse.json({ ok: true, fired, note: "Subscription expired — cleared" });
    }
  }

  if (fired > 0) {
    await supabase
      .from("push_subscriptions")
      .update({ last_notified: updatedNotified, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }

  return NextResponse.json({ ok: true, fired });
}
```

- [ ] **Step 2: Update `vercel.json` to add the hourly push cron**

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
    },
    {
      "path": "/api/push/notify",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass.

- [ ] **Step 4: Commit Phase 3**

```bash
git add supabase/migrations/002_push_subscriptions.sql public/sw.js hooks/usePushNotifications.ts components/PushInit.tsx app/api/push/subscribe/route.ts app/api/push/sync-watchlist/route.ts lib/push-triggers.ts app/api/push/notify/route.ts app/layout.tsx hooks/useWatchlist.ts vercel.json __tests__/push-triggers.test.ts
git commit -m "feat: add Web Push notifications with 5 trigger conditions on watched cards

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 5: Deploy and smoke-test**

```bash
git push
```

After Vercel deploys:
1. Open https://mtg-intel.vercel.app in a browser that supports Web Push
2. Grant notification permission when prompted
3. Navigate to a card detail page and click ★ Watch
4. Trigger the notify endpoint manually: `curl -H "x-cron-secret: $CRON_SECRET" https://mtg-intel.vercel.app/api/push/notify`
5. Verify a push notification fires in the browser

---

## Environment Variable Checklist

Before deploying Phase 3, confirm these are set in both `.env.local` and Vercel project settings:

| Variable | Where | Description |
|---|---|---|
| `VAPID_PUBLIC_KEY` | Server + client | VAPID public key (from web-push generate) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client | Same value as above — needed by usePushNotifications |
| `VAPID_PRIVATE_KEY` | Server only | VAPID private key |
| `VAPID_SUBJECT` | Server only | `mailto:brandon.liming@gmail.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | From Supabase dashboard → Settings → API |
| `CRON_SECRET` | Server only | Random hex string — also set in Vercel cron header config |
| `PRICE_ALERT_THRESHOLD` | Server only | Optional, defaults to `10` (percent) |
