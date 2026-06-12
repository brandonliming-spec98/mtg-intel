import { describe, it, expect, vi } from "vitest";
import { computeOutcomeScore, upsertAlgorithm } from "@/lib/projection-feedback";
import type { ProjectionAlgorithmDef } from "@/types";

describe("computeOutcomeScore", () => {
  it("returns 1.0 when all three signals are correct", () => {
    expect(computeOutcomeScore(true, true, true)).toBeCloseTo(1.0);
  });

  it("returns 0.0 when all three signals are incorrect", () => {
    expect(computeOutcomeScore(false, false, false)).toBeCloseTo(0.0);
  });

  it("normalizes weights when user signal is absent", () => {
    // price(0.5) + signal(0.3) both correct, user absent
    // score = (1*0.5 + 1*0.3) / (0.5+0.3) = 1.0
    expect(computeOutcomeScore(true, true, null)).toBeCloseTo(1.0);
  });

  it("normalizes correctly for partial signals", () => {
    // Only price collected (correct), others absent
    // score = (1*0.5) / 0.5 = 1.0
    expect(computeOutcomeScore(true, null, null)).toBeCloseTo(1.0);
  });

  it("returns 0.625 when price correct and signal wrong, user absent", () => {
    // (1*0.5 + 0*0.3) / (0.5+0.3) = 0.5/0.8 = 0.625
    expect(computeOutcomeScore(true, false, null)).toBeCloseTo(0.625);
  });
});

const makeAlgoDef = (purpose_key: string, confidence: number): ProjectionAlgorithmDef => ({
  purpose_key,
  purpose_description: "test",
  conditions: [{ field: "break_score", op: "gte", val: 7.0 }],
  verdict: "BUY",
  confidence,
});

describe("upsertAlgorithm", () => {
  it("inserts when no existing slot", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
        insert: insertMock,
        update: vi.fn(),
      }),
    };
    await upsertAlgorithm(supabase as never, makeAlgoDef("new-key", 0.85));
    expect(insertMock).toHaveBeenCalledOnce();
  });

  it("replaces when new confidence is higher", async () => {
    const updateMock = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const existing = { id: "x", algorithm_json: makeAlgoDef("existing-key", 0.70) };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
          }),
        }),
        insert: vi.fn(),
        update: updateMock,
      }),
    };
    await upsertAlgorithm(supabase as never, makeAlgoDef("existing-key", 0.90));
    expect(updateMock).toHaveBeenCalledOnce();
  });

  it("discards when new confidence is not higher", async () => {
    const insertMock = vi.fn();
    const updateMock = vi.fn();
    const existing = { id: "x", algorithm_json: makeAlgoDef("existing-key", 0.85) };
    const supabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: existing, error: null }),
          }),
        }),
        insert: insertMock,
        update: updateMock,
      }),
    };
    await upsertAlgorithm(supabase as never, makeAlgoDef("existing-key", 0.80));
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
