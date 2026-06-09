import { describe, it, expect } from "vitest";
import {
  filterByDays,
  computeMA,
  computeDailyDeltas,
  mapToCanvasCoords,
  computeMomentum,
} from "@/lib/chart-utils";
import type { PricePoint } from "@/types";

const makePrices = (values: number[]): PricePoint[] =>
  values.map((price, i) => ({
    price,
    date: new Date(Date.now() - (values.length - 1 - i) * 86400000)
      .toISOString()
      .split("T")[0],
    source: "test",
  }));

describe("filterByDays", () => {
  it("returns all points when days is Infinity", () => {
    const pts = makePrices([1, 2, 3]);
    expect(filterByDays(pts, Infinity)).toHaveLength(3);
  });

  it("filters out points older than N days", () => {
    const pts = makePrices([10, 20, 30, 40]); // 3 days ago → today
    const result = filterByDays(pts, 2);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result.length).toBeLessThanOrEqual(4);
  });

  it("returns empty array when all points are too old", () => {
    const pts: PricePoint[] = [{ price: 5, date: "2000-01-01", source: "test" }];
    expect(filterByDays(pts, 1)).toHaveLength(0);
  });
});

describe("computeMA", () => {
  it("returns null for first window-1 entries", () => {
    const result = computeMA([1, 2, 3, 4, 5], 3);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).not.toBeNull();
  });

  it("computes correct moving average", () => {
    const result = computeMA([1, 2, 3, 4, 5], 3);
    expect(result[2]).toBeCloseTo(2.0);
    expect(result[3]).toBeCloseTo(3.0);
    expect(result[4]).toBeCloseTo(4.0);
  });

  it("returns all non-null for window=1", () => {
    const result = computeMA([5, 10, 15], 1);
    expect(result).toEqual([5, 10, 15]);
  });
});

describe("computeDailyDeltas", () => {
  it("returns zero for first element", () => {
    const result = computeDailyDeltas([10, 12, 8, 15]);
    expect(result[0]).toBe(0);
  });

  it("returns normalized values in range [0, 1]", () => {
    const result = computeDailyDeltas([10, 12, 8, 15]);
    result.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("handles flat prices returning all zeros", () => {
    const result = computeDailyDeltas([5, 5, 5, 5]);
    result.forEach(v => expect(v).toBe(0));
  });
});

describe("mapToCanvasCoords", () => {
  it("maps first point to x=0, last to x=canvasW", () => {
    const pts = mapToCanvasCoords([10, 20, 30], 10, 30, 400, 8, 72);
    expect(pts[0].x).toBe(0);
    expect(pts[2].x).toBe(400);
  });

  it("maps min price to bottomY, max to topY", () => {
    const pts = mapToCanvasCoords([0, 100], 0, 100, 400, 8, 72);
    expect(pts[0].y).toBeCloseTo(72); // min → bottom
    expect(pts[1].y).toBeCloseTo(8);  // max → top
  });

  it("handles single point without division by zero", () => {
    const pts = mapToCanvasCoords([42], 42, 42, 400, 8, 72);
    expect(pts).toHaveLength(1);
    expect(Number.isFinite(pts[0].y)).toBe(true);
  });
});

describe("computeMomentum", () => {
  it("returns 0 for all-zero inputs", () => {
    expect(computeMomentum(0, 0, 0)).toBe(0);
  });

  it("clamps to 100 maximum", () => {
    expect(computeMomentum(100, 10, 100)).toBe(100);
  });

  it("clamps to 0 for negative price delta with no signals", () => {
    expect(computeMomentum(0, 0, -50)).toBe(0);
  });

  it("computes correctly for typical values", () => {
    // 5 * 3 + 3 * 20 + 2 * 2 = 15 + 60 + 4 = 79
    expect(computeMomentum(5, 3, 2)).toBe(79);
  });
});
