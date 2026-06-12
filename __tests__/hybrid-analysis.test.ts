import { describe, it, expect, vi, afterEach } from "vitest";
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
  content: "Ragavan, Nimble Pilferer is cheap right now.",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Ragavan post",
  published_at: "2026-06-09T09:00:00Z",
};

const ruleSignal = makeSignal({ sentiment: "neutral", signal_strength: 3, summary: "Card mentioned in source" });
const claudeSignal = makeSignal({ sentiment: "bullish", signal_strength: 9 });

describe("hybridAnalyze", () => {
  afterEach(() => vi.unstubAllEnvs());


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

  it("falls back to rule-based when ANTHROPIC_API_KEY is absent and score >= 100", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const ruleBased = vi.fn().mockResolvedValue([ruleSignal]);

    const signals = await hybridAnalyze({ ...baseInput, score: 150 }, { ruleBased });

    expect(ruleBased).toHaveBeenCalledOnce();
    expect(signals).toEqual([ruleSignal]);
  });

  it("returns empty array when rule-based fails and ANTHROPIC_API_KEY is absent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const ruleBased = vi.fn().mockRejectedValue(new Error("network error"));

    const signals = await hybridAnalyze({ ...baseInput, score: 50 }, { ruleBased });

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
