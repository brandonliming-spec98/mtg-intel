import { describe, it, expect, vi } from "vitest";
import { storeSignals, fetchSignals, type SignalQuery } from "@/lib/supabase-signals";
import type { IntelSignal } from "@/types";

const makeSignal = (id: string): IntelSignal => ({
  id,
  card_name_raw: "Ragavan, Nimble Pilferer",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Buy Ragavan",
  sentiment: "bullish",
  signal_strength: 8,
  summary: "Underpriced for its power level",
  published_at: "2026-06-04T12:00:00Z",
});

const makeSupabase = (overrides: Record<string, unknown> = {}) => ({
  from: vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
    select: vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
    ...overrides,
  }),
});

describe("storeSignals", () => {
  it("inserts all signals into the intel_signals table", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabase = { from: vi.fn().mockReturnValue({ insert }) };

    await storeSignals([makeSignal("s1"), makeSignal("s2")], supabase as never);

    expect(supabase.from).toHaveBeenCalledWith("intel_signals");
    expect(insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "s1" }),
        expect.objectContaining({ id: "s2" }),
      ])
    );
  });

  it("throws when Supabase returns an error", async () => {
    const supabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: { message: "duplicate key" } }),
      }),
    };

    await expect(storeSignals([makeSignal("s1")], supabase as never)).rejects.toThrow(
      "duplicate key"
    );
  });

  it("does nothing when given an empty array", async () => {
    const supabase = makeSupabase();
    await storeSignals([], supabase as never);
    expect(supabase.from).not.toHaveBeenCalled();
  });
});

describe("fetchSignals", () => {
  it("fetches recent signals ordered by ingested_at desc", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [makeSignal("s1")], error: null });
    const order = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ order });
    const supabase = { from: vi.fn().mockReturnValue({ select }) };

    const result = await fetchSignals({}, supabase as never);

    expect(supabase.from).toHaveBeenCalledWith("intel_signals");
    expect(order).toHaveBeenCalledWith("ingested_at", { ascending: false });
    expect(limit).toHaveBeenCalledWith(50);
    expect(result).toHaveLength(1);
  });

  it("filters by card name when query.cardName is provided", async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const order = vi.fn().mockReturnValue({ eq });
    const select = vi.fn().mockReturnValue({ order });
    const supabase = { from: vi.fn().mockReturnValue({ select }) };

    const query: SignalQuery = { cardName: "Ragavan, Nimble Pilferer" };
    await fetchSignals(query, supabase as never);

    expect(eq).toHaveBeenCalledWith("card_name_raw", "Ragavan, Nimble Pilferer");
  });
});
