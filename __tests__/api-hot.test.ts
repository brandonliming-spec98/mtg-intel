import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase-signals", () => ({
  fetchSignals: vi.fn(),
}));

import { GET } from "@/app/api/hot/route";
import { fetchSignals } from "@/lib/supabase-signals";
import type { IntelSignal } from "@/types";

function makeSignal(overrides: Partial<IntelSignal> = {}): IntelSignal {
  return {
    id: "sig-1",
    card_name_raw: "Sol Ring",
    source_type: "reddit",
    source_url: "https://reddit.com/1",
    source_title: "Test",
    sentiment: "bullish",
    signal_type: "buy_hype",
    sell_window: null,
    signal_strength: 6,
    summary: "Spiking",
    published_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("GET /api/hot", () => {
  it("returns buy and sell sections", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([
      makeSignal({ card_name_raw: "Sol Ring", signal_type: "buy_hype", sentiment: "bullish" }),
      makeSignal({ card_name_raw: "Black Lotus", signal_type: "reprint_announced", sentiment: "bearish", sell_window: "2026-08-15" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("buy");
    expect(body).toHaveProperty("sell");
    expect(body.buy).toHaveLength(1);
    expect(body.sell).toHaveLength(1);
    expect(body.buy[0].card_name).toBe("Sol Ring");
    expect(body.sell[0].card_name).toBe("Black Lotus");
  });

  it("includes sell_window on sell cards", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([
      makeSignal({ card_name_raw: "Mox Pearl", signal_type: "reprint_announced", sentiment: "bearish", sell_window: "2026-09-01" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.sell[0].sell_window).toBe("2026-09-01");
  });

  it("aggregates multiple signals for the same card into one entry", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([
      makeSignal({ id: "a", card_name_raw: "Sol Ring", signal_type: "buy_hype" }),
      makeSignal({ id: "b", card_name_raw: "Sol Ring", signal_type: "buy_hype" }),
      makeSignal({ id: "c", card_name_raw: "Sol Ring", signal_type: "buy_hype" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.buy).toHaveLength(1);
    expect(body.buy[0].signal_count).toBe(3);
  });

  it("sorts buy cards by signal_count descending", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([
      makeSignal({ id: "a", card_name_raw: "Sol Ring", signal_type: "buy_hype" }),
      makeSignal({ id: "b", card_name_raw: "Jeweled Lotus", signal_type: "buy_hype" }),
      makeSignal({ id: "c", card_name_raw: "Jeweled Lotus", signal_type: "buy_hype" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.buy[0].card_name).toBe("Jeweled Lotus");
    expect(body.buy[1].card_name).toBe("Sol Ring");
  });

  it("prefers the earliest sell_window when multiple sell signals exist for a card", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([
      makeSignal({ id: "a", card_name_raw: "Mox Pearl", signal_type: "reprint_announced", sentiment: "bearish", sell_window: "2026-10-01" }),
      makeSignal({ id: "b", card_name_raw: "Mox Pearl", signal_type: "reprint_announced", sentiment: "bearish", sell_window: "2026-08-01" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.sell[0].sell_window).toBe("2026-08-01");
  });

  it("returns empty arrays when no signals exist", async () => {
    vi.mocked(fetchSignals).mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(body.buy).toEqual([]);
    expect(body.sell).toEqual([]);
  });

  it("returns 500 when fetchSignals throws", async () => {
    vi.mocked(fetchSignals).mockRejectedValue(new Error("DB down"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
