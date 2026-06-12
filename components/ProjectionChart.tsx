"use client";

import type { PricePoint, ProjectionVerdict } from "@/types";

const VERDICT_COLOR: Record<ProjectionVerdict, string> = {
  BUY:  "#22c55e",
  HOLD: "#d4a843",
  SELL: "#ef4444",
};

const VERDICT_BG: Record<ProjectionVerdict, string> = {
  BUY:  "#071207",
  HOLD: "#120e04",
  SELL: "#120707",
};

function priceTrend(history: PricePoint[]): "rising" | "falling" | "flat" {
  if (history.length < 8) return "flat";
  const recent = history.slice(-7).reduce((s, p) => s + p.price, 0) / 7;
  const prev = history.slice(-14, -7).reduce((s, p) => s + p.price, 0) / 7;
  if (prev === 0) return "flat";
  const delta = (recent - prev) / prev;
  if (delta > 0.03) return "rising";
  if (delta < -0.03) return "falling";
  return "flat";
}

export function getPriceTrend(history: PricePoint[]): "rising" | "falling" | "flat" {
  return priceTrend(history);
}

interface Props {
  history: PricePoint[];
  verdict: ProjectionVerdict;
  sellWindow?: string | null;
  width?: number;
  height?: number;
}

export default function ProjectionChart({
  history,
  verdict,
  sellWindow,
  width = 240,
  height = 110,
}: Props) {
  const last6mo = history.slice(-180);
  if (last6mo.length < 2) {
    return (
      <div
        style={{ width, height, background: VERDICT_BG[verdict] }}
        className="flex items-center justify-center text-neutral text-xs font-mono"
      >
        No price history
      </div>
    );
  }

  const prices = last6mo.map((p) => p.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const pad = height * 0.1;

  const points = last6mo.map((p, i) => ({
    x: (i / (last6mo.length - 1)) * width,
    y: height - pad - ((p.price - minP) / range) * (height - pad * 2),
  }));

  const pathD =
    points
      .map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`)
      .join(" ");

  const areaD =
    pathD +
    ` L${width},${height} L0,${height} Z`;

  const color = VERDICT_COLOR[verdict];
  const gradId = `grad-${verdict}`;

  // Detect peak: if max is in first 80% of the chart
  const peakIdx = prices.indexOf(maxP);
  const showPeak =
    verdict === "SELL" && peakIdx < last6mo.length * 0.8 && peakIdx > 0;
  const peakX = points[peakIdx]?.x ?? 0;
  const peakY = points[peakIdx]?.y ?? 0;

  const startPrice = prices[0];
  const currentPrice = prices[prices.length - 1];
  const deltaStr =
    startPrice > 0
      ? `${currentPrice >= startPrice ? "▲" : "▼"} ${Math.abs(((currentPrice - startPrice) / startPrice) * 100).toFixed(1)}%`
      : "";

  // Month labels (6 labels spread evenly)
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const idx = Math.round((i / 5) * (last6mo.length - 1));
    const d = new Date(last6mo[idx]?.date ?? "");
    return isNaN(d.getTime()) ? "" : d.toLocaleString("default", { month: "short" });
  });

  return (
    <div style={{ position: "relative", width, height, background: VERDICT_BG[verdict] }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="none"
        style={{ display: "block" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={0} y1={height * t} x2={width} y2={height * t}
            stroke={color} strokeOpacity={0.06} strokeWidth={1}
          />
        ))}
        {/* Area fill */}
        <path d={areaD} fill={`url(#${gradId})`} />
        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        {/* Current dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={points[points.length - 1].y}
          r={3.5}
          fill={color}
          stroke={VERDICT_BG[verdict]}
          strokeWidth={1.5}
        />
        {/* Peak annotation */}
        {showPeak && (
          <>
            <line
              x1={peakX} y1={0} x2={peakX} y2={peakY}
              stroke={color} strokeOpacity={0.3} strokeWidth={1}
              strokeDasharray="2,2"
            />
            <text x={peakX + 3} y={10} fontSize={6} fill={color} fillOpacity={0.5} fontFamily="monospace">
              PEAK
            </text>
          </>
        )}
      </svg>

      {/* Overlays */}
      <div style={{ position: "absolute", top: 6, left: 7, fontFamily: "monospace", fontSize: 9, color, opacity: 0.6, background: "rgba(0,0,0,0.5)", padding: "2px 5px", borderRadius: 3 }}>
        ${startPrice.toFixed(2)}
      </div>
      <div style={{ position: "absolute", top: 6, right: 7, fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "#e6edf3", background: "rgba(0,0,0,0.75)", padding: "3px 7px", borderRadius: 4, border: "1px solid rgba(255,255,255,0.08)" }}>
        ${currentPrice.toFixed(2)}
      </div>
      <div style={{ position: "absolute", top: 30, right: 7, fontFamily: "monospace", fontSize: 9, color, background: "rgba(0,0,0,0.6)", padding: "2px 5px", borderRadius: 3 }}>
        {deltaStr}
      </div>
      {sellWindow && (
        <div style={{ position: "absolute", bottom: 18, left: 7, fontFamily: "monospace", fontSize: 8, fontWeight: 700, color, background: `${color}14`, border: `1px solid ${color}50`, padding: "2px 6px", borderRadius: 3 }}>
          {sellWindow}
        </div>
      )}
      {/* Month labels */}
      <div style={{ position: "absolute", bottom: 3, left: 0, right: 0, display: "flex", justifyContent: "space-between", padding: "0 6px", fontFamily: "monospace", fontSize: 7, color, opacity: 0.4, pointerEvents: "none" }}>
        {monthLabels.map((m, i) => <span key={i}>{m}</span>)}
      </div>
    </div>
  );
}
