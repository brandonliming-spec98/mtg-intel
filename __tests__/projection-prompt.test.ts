import { describe, it, expect, vi } from "vitest";
import { parseProjectionResponse, buildProjectionInput } from "@/lib/projection-prompt";
import type { CardFeatures } from "@/types";

const validResponse = JSON.stringify({
  verdict: "BUY",
  confidence: 0.85,
  reasoning: "Break score surging. No reprint announced.",
  flavor_text: "The next tournament cycle opens in 26 days.",
  key_signals: ["Break Score 8.2", "Bullish Sentiment"],
  signal_pips: ["sentiment", "mechanics"],
  algorithm: {
    purpose_key: "high-break-bullish",
    purpose_description: "High break score with bullish sentiment",
    conditions: [
      { field: "break_score", op: "gte", val: 7.5 },
      { field: "sentiment", op: "eq", val: "bullish" },
    ],
    verdict: "BUY",
    confidence: 0.85,
  },
});

describe("parseProjectionResponse", () => {
  it("parses a valid Claude JSON response", () => {
    const result = parseProjectionResponse(validResponse);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("BUY");
    expect(result!.confidence).toBe(0.85);
    expect(result!.algorithm.purpose_key).toBe("high-break-bullish");
  });

  it("parses response wrapped in markdown code fences", () => {
    const fenced = "```json\n" + validResponse + "\n```";
    const result = parseProjectionResponse(fenced);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("BUY");
  });

  it("returns null for malformed JSON", () => {
    expect(parseProjectionResponse("not json at all")).toBeNull();
  });

  it("returns null when verdict is missing", () => {
    const bad = JSON.stringify({ confidence: 0.8, reasoning: "ok" });
    expect(parseProjectionResponse(bad)).toBeNull();
  });

  it("returns null when verdict is invalid", () => {
    const bad = JSON.stringify({ ...JSON.parse(validResponse), verdict: "MAYBE" });
    expect(parseProjectionResponse(bad)).toBeNull();
  });
});

describe("buildProjectionInput", () => {
  it("includes all required fields", () => {
    const features: CardFeatures = {
      break_score: 8.2,
      ban_risk: 0.12,
      sentiment: "bullish",
      signal_count: 4,
      price_trend_7d: "rising",
    };
    const input = buildProjectionInput("Ragavan", features, [], []);
    expect(input).toContain("Ragavan");
    expect(input).toContain("8.2");
    expect(input).toContain("bullish");
  });
});
