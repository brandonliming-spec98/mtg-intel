import type { PricePoint } from "@/types";

export function filterByDays(history: PricePoint[], days: number): PricePoint[] {
  if (days === Infinity) return history;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return history.filter((p) => p.date >= cutoffStr);
}

export function computeMA(prices: number[], window: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < window - 1) return null;
    return prices.slice(i - window + 1, i + 1).reduce((a, b) => a + b, 0) / window;
  });
}

// Returns normalized [0,1] absolute daily price changes (proxy for volume).
export function computeDailyDeltas(prices: number[]): number[] {
  if (prices.length <= 1) return prices.map(() => 0);
  const deltas = prices.map((p, i) =>
    i === 0 ? 0 : Math.abs(p - prices[i - 1])
  );
  const maxDelta = Math.max(...deltas, 0.001);
  return deltas.map((d) => d / maxDelta);
}

// Maps price values to {x,y} canvas coordinates within the given vertical region.
// min/max are passed explicitly so MA30 and price line share the same scale.
export function mapToCanvasCoords(
  values: number[],
  min: number,
  max: number,
  canvasW: number,
  topY: number,
  bottomY: number
): { x: number; y: number }[] {
  if (values.length === 0) return [];
  const range = max === min ? 1 : max - min;
  return values.map((v, i) => ({
    x: values.length === 1 ? 0 : (i / (values.length - 1)) * canvasW,
    y: bottomY - ((v - min) / range) * (bottomY - topY),
  }));
}

// Phase 2 momentum score (0–100).
// Phase 3 will replace this with the full weighted formula.
export function computeMomentum(
  signalCount7d: number,
  avgStrength: number,
  priceDeltaPct: number
): number {
  return Math.min(
    100,
    Math.max(0, Math.round(signalCount7d * 3 + avgStrength * 20 + priceDeltaPct * 2))
  );
}
