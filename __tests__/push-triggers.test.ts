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
  from: vi.fn().mockImplementation((table: string) => {
    if (table === "intel_signals") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockResolvedValue({ data: signals, error: null }),
          }),
        }),
      };
    }
    if (table === "card_mechanics") {
      return {
        select: vi.fn().mockReturnValue({
          gt: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ data: mechanics, error: null }),
          }),
        }),
      };
    }
    return {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };
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
