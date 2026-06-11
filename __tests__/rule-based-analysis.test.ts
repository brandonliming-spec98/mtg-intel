import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisInput } from "@/lib/claude-analysis";
import { ruleBasedAnalyze } from "@/lib/rule-based-analysis";

vi.mock("@/lib/scryfall-catalog", () => ({
  getCardCatalog: vi.fn().mockResolvedValue(
    new Set(["Sol Ring", "Black Lotus", "Mox Pearl", "Jeweled Lotus",
             "Ragavan, Nimble Pilferer", "Lightning Bolt"])
  ),
}));

const baseInput: AnalysisInput = {
  content: "",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Test post",
  published_at: "2026-06-09T09:00:00Z",
};

const mockCatalog = new Set(["Ragavan, Nimble Pilferer", "Black Lotus", "Lightning Bolt"]);

beforeEach(() => {
  vi.resetModules();
});

describe("ruleBasedAnalyze", () => {
  it("returns one signal per matched card name", async () => {
    vi.doMock("@/lib/scryfall-catalog", () => ({
      getCardCatalog: vi.fn().mockResolvedValue(mockCatalog),
    }));
    const { ruleBasedAnalyze: analyze } = await import("@/lib/rule-based-analysis");

    const signals = await analyze(
      { ...baseInput, content: "Ragavan, Nimble Pilferer is underpriced. Also Lightning Bolt for burn." },
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

    const signals = await analyze({ ...baseInput, content: "Ragavan, Nimble Pilferer is around." });
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

describe("ruleBasedAnalyze — signal_type detection", () => {
  it("tags buy_hype + bullish for spiking/buying language", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Sol Ring is spiking hard, definitely buying more copies." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Sol Ring");
    expect(sig!.signal_type).toBe("buy_hype");
    expect(sig!.sentiment).toBe("bullish");
    expect(sig!.signal_strength).toBeGreaterThan(3);
  });

  it("tags format_staple + bullish for staple/EDH language", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Sol Ring is a commander staple in every deck." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Sol Ring");
    expect(sig!.signal_type).toBe("format_staple");
    expect(sig!.sentiment).toBe("bullish");
  });

  it("tags reprint_announced + bearish for reprint keywords", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Sol Ring is being reprinted in the new Commander precon." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Sol Ring");
    expect(sig!.signal_type).toBe("reprint_announced");
    expect(sig!.sentiment).toBe("bearish");
    expect(sig!.signal_strength).toBeGreaterThan(3);
  });

  it("tags reprint_announced for Secret Lair mentions", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Black Lotus is coming to Secret Lair next month." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Black Lotus");
    expect(sig!.signal_type).toBe("reprint_announced");
    expect(sig!.sentiment).toBe("bearish");
  });

  it("tags price_peak + bearish for peaked/sell-now language", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Jeweled Lotus has peaked — great time to sell into the hype." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Jeweled Lotus");
    expect(sig!.signal_type).toBe("price_peak");
    expect(sig!.sentiment).toBe("bearish");
  });

  it("tags set_release_pressure + bearish when an upcoming set drop is mentioned with price fall language", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Mox Pearl will be in the new set dropping soon — prices should fall." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Mox Pearl");
    expect(sig!.signal_type).toBe("set_release_pressure");
    expect(sig!.sentiment).toBe("bearish");
  });

  it("extracts sell_window as ISO date string when a date is present near a sell signal", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "Sol Ring reprint confirmed releasing August 15 — sell before then." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Sol Ring");
    expect(sig!.signal_type).toBe("reprint_announced");
    expect(sig!.sell_window).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("defaults to general + neutral for plain card mentions with no signal keywords", async () => {
    const signals = await ruleBasedAnalyze(
      { ...baseInput, content: "I was playing Sol Ring in my deck last night." }
    );
    const sig = signals.find((s) => s.card_name_raw === "Sol Ring");
    expect(sig!.signal_type).toBe("general");
    expect(sig!.sentiment).toBe("neutral");
    expect(sig!.signal_strength).toBe(3);
  });
});
