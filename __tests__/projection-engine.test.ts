import { describe, it, expect } from "vitest";
import { evaluateAlgorithm, runAlgorithms } from "@/lib/projection-engine";
import type { ProjectionAlgorithm, CardFeatures } from "@/types";

const makeAlgo = (
  purpose_key: string,
  conditions: ProjectionAlgorithm["algorithm_json"]["conditions"],
  verdict: "BUY" | "HOLD" | "SELL" = "BUY",
  confidence = 0.85,
  promoted = true
): ProjectionAlgorithm => ({
  id: "test-id",
  purpose_key,
  purpose_description: "test",
  algorithm_json: { purpose_key, purpose_description: "test", conditions, verdict, confidence },
  success_rate: 0.8,
  validation_count: 5,
  promoted,
  created_at: new Date().toISOString(),
  last_validated_at: null,
});

const baseFeatures: CardFeatures = {
  break_score: 8.2,
  ban_risk: 0.12,
  sentiment: "bullish",
  signal_count: 4,
  price_trend_7d: "rising",
};

describe("evaluateAlgorithm", () => {
  it("matches when all conditions pass", () => {
    const algo = makeAlgo("test", [
      { field: "break_score", op: "gte", val: 7.5 },
      { field: "sentiment", op: "eq", val: "bullish" },
    ]);
    expect(evaluateAlgorithm(algo.algorithm_json, baseFeatures)).toBe(true);
  });

  it("rejects when one condition fails", () => {
    const algo = makeAlgo("test", [
      { field: "break_score", op: "gte", val: 9.0 },
    ]);
    expect(evaluateAlgorithm(algo.algorithm_json, baseFeatures)).toBe(false);
  });

  it("handles all six operators", () => {
    const features: CardFeatures = { ...baseFeatures, break_score: 5.0 };
    expect(evaluateAlgorithm(makeAlgo("a", [{ field: "break_score", op: "gt",  val: 4.0 }]).algorithm_json, features)).toBe(true);
    expect(evaluateAlgorithm(makeAlgo("b", [{ field: "break_score", op: "gte", val: 5.0 }]).algorithm_json, features)).toBe(true);
    expect(evaluateAlgorithm(makeAlgo("c", [{ field: "break_score", op: "lt",  val: 6.0 }]).algorithm_json, features)).toBe(true);
    expect(evaluateAlgorithm(makeAlgo("d", [{ field: "break_score", op: "lte", val: 5.0 }]).algorithm_json, features)).toBe(true);
    expect(evaluateAlgorithm(makeAlgo("e", [{ field: "sentiment",   op: "eq",  val: "bullish" }]).algorithm_json, features)).toBe(true);
    expect(evaluateAlgorithm(makeAlgo("f", [{ field: "sentiment",   op: "neq", val: "bearish" }]).algorithm_json, features)).toBe(true);
  });
});

describe("runAlgorithms", () => {
  it("returns null when fewer than 2 promoted algorithms match", () => {
    const algos = [makeAlgo("only-one", [{ field: "break_score", op: "gte", val: 7.5 }])];
    expect(runAlgorithms(algos, baseFeatures)).toBeNull();
  });

  it("returns null when algorithms disagree on verdict", () => {
    const algos = [
      makeAlgo("a", [{ field: "break_score", op: "gte", val: 7.5 }], "BUY"),
      makeAlgo("b", [{ field: "break_score", op: "gte", val: 7.5 }], "SELL"),
    ];
    expect(runAlgorithms(algos, baseFeatures)).toBeNull();
  });

  it("returns mean confidence when 2+ promoted algorithms agree", () => {
    const algos = [
      makeAlgo("a", [{ field: "break_score", op: "gte", val: 7.5 }], "BUY", 0.80),
      makeAlgo("b", [{ field: "sentiment",   op: "eq",  val: "bullish" }], "BUY", 0.90),
    ];
    const result = runAlgorithms(algos, baseFeatures);
    expect(result).not.toBeNull();
    expect(result!.verdict).toBe("BUY");
    expect(result!.confidence).toBeCloseTo(0.85);
  });

  it("ignores non-promoted algorithms", () => {
    const algos = [
      makeAlgo("a", [{ field: "break_score", op: "gte", val: 7.5 }], "BUY", 0.80, false),
      makeAlgo("b", [{ field: "sentiment",   op: "eq",  val: "bullish" }], "BUY", 0.90, false),
    ];
    expect(runAlgorithms(algos, baseFeatures)).toBeNull();
  });

  it("returns null when no algorithms match", () => {
    const algos = [
      makeAlgo("a", [{ field: "break_score", op: "gte", val: 9.9 }], "BUY"),
      makeAlgo("b", [{ field: "break_score", op: "gte", val: 9.9 }], "BUY"),
    ];
    expect(runAlgorithms(algos, baseFeatures)).toBeNull();
  });
});
