import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AnalysisInput } from "@/lib/claude-analysis";

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
