"use client";

import { useState } from "react";
import type { WatchlistEntry, Projection, PricePoint, ProjectionVerdict } from "@/types";
import ProjectionChart from "@/components/ProjectionChart";
import ProjectionManaBar from "@/components/ProjectionManaBar";

const VERDICT_COLORS: Record<ProjectionVerdict, { frame: string; text: string; band: string; bg: string }> = {
  BUY:  { frame: "#22c55e", text: "#4ade80", band: "linear-gradient(90deg,#0d3d0d,#22c55e,#16a34a,#22c55e,#0d3d0d)", bg: "linear-gradient(170deg,#0d1f0d,#0f2510)" },
  HOLD: { frame: "#d4a843", text: "#d4a843", band: "linear-gradient(90deg,#5a3e00,#d4a843,#c8982a,#d4a843,#5a3e00)", bg: "linear-gradient(170deg,#1e1608,#251c09)" },
  SELL: { frame: "#ef4444", text: "#f87171", band: "linear-gradient(90deg,#5a0d0d,#ef4444,#dc2626,#ef4444,#5a0d0d)", bg: "linear-gradient(170deg,#1f0d0d,#250f0f)" },
};

const SIGNAL_STRENGTH_RARITY = (score: number): { color: string; symbol: string } => {
  if (score >= 8) return { color: "#ff8c00", symbol: "⬟" };
  if (score >= 6) return { color: "#d4a843", symbol: "⬟" };
  return { color: "#a8b8c8", symbol: "⬟" };
};

interface Props {
  entry: WatchlistEntry;
  projection: Projection | null;
  priceHistory: PricePoint[];
  showBack?: boolean;
  size?: "sm" | "md";
}

export default function ProjectionFlipCard({
  entry,
  projection,
  priceHistory,
  showBack = false,
  size = "md",
}: Props) {
  const [flipped, setFlipped] = useState(showBack);
  const cardWidth = size === "sm" ? 180 : 220;
  const cardHeight = size === "sm" ? 270 : 330;
  const chartHeight = size === "sm" ? 84 : 105;

  const verdict = projection?.verdict ?? "HOLD";
  const vc = VERDICT_COLORS[verdict];
  const rarity = SIGNAL_STRENGTH_RARITY(projection ? projection.confidence * 10 : 5);
  const typeLine = entry.type_line ?? entry.set_name;

  const nameFontSize = cardWidth < 200 ? 9.5 : 11.5;
  const textFontSize = cardWidth < 200 ? 8 : 9;

  return (
    <div
      style={{ width: cardWidth, height: cardHeight, perspective: 900, cursor: "pointer", flexShrink: 0 }}
      onClick={() => !showBack && setFlipped((f) => !f)}
    >
      <div
        style={{
          width: "100%", height: "100%",
          position: "relative",
          transformStyle: "preserve-3d",
          transition: "transform 0.55s cubic-bezier(0.4,0.2,0.2,1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          borderRadius: 14,
          boxShadow: "0 0 0 3px #0a0a0a, 0 20px 60px rgba(0,0,0,0.85)",
        }}
      >
        {/* ── FRONT FACE ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            borderRadius: 14,
            overflow: "hidden",
            background: vc.bg,
            display: "flex", flexDirection: "column",
            fontFamily: "Georgia,'Times New Roman',serif",
          }}
        >
          {/* Color band */}
          <div style={{ height: 7, background: vc.band }} />
          {/* Name bar */}
          <div style={{ padding: "5px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: nameFontSize, fontWeight: 700, color: vc.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: cardWidth - 50 }}>
              {entry.card_name}
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: rarity.color, textShadow: `0 0 4px ${rarity.color}` }}>{rarity.symbol}</span>
          </div>
          {/* Art box */}
          <div style={{ flex: 1, margin: "5px 8px", borderRadius: 3, overflow: "hidden", border: "2px solid #0a0a0a", position: "relative" }}>
            {entry.image_uri ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={entry.image_uri} alt={entry.card_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1a1a2e,#0f3460)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>🃏</div>
            )}
            {projection && (
              <div style={{ position: "absolute", top: 6, left: 7, background: `${vc.frame}14`, border: `1px solid ${vc.frame}50`, color: vc.text, borderRadius: 3, padding: "2px 6px", fontSize: 8, fontFamily: "monospace", fontWeight: 700 }}>
                {projection.verdict}
              </div>
            )}
            <div style={{ position: "absolute", top: 6, right: 7, background: "rgba(0,0,0,0.65)", color: `${vc.text}b0`, borderRadius: 3, padding: "2px 5px", fontSize: 7, fontFamily: "monospace" }}>
              ↺ projection
            </div>
          </div>
          {/* Type line */}
          <div style={{ margin: "0 8px 4px", padding: "2px 6px", background: "rgba(0,0,0,0.4)", border: `1px solid ${vc.frame}30`, borderRadius: 2, fontSize: 8, color: `${vc.text}80`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeLine}</span>
          </div>
          {/* Footer */}
          <div style={{ padding: "3px 10px 7px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(0,0,0,0.4)", fontSize: 7, fontFamily: "monospace", color: `${vc.frame}80` }}>
            <span>{entry.set_code.toUpperCase()} #{entry.collector_number} · {entry.finish}</span>
            <span>{projection ? `${Math.round(projection.confidence * 100)}% conf` : "—"}</span>
          </div>
        </div>

        {/* ── BACK FACE (projection) ── */}
        <div
          style={{
            position: "absolute", inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 14,
            overflow: "hidden",
            background: vc.bg,
            display: "flex", flexDirection: "column",
            fontFamily: "Georgia,'Times New Roman',serif",
          }}
        >
          {/* Color band */}
          <div style={{ height: 7, background: vc.band }} />

          {/* Name bar */}
          <div style={{ padding: "5px 10px 4px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#c9922a" }}>Market Projection</div>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {projection && <ProjectionManaBar pips={projection.signal_pips} />}
              <div style={{ display: "flex", gap: 2 }}>
                <span style={{ fontSize: 8, fontFamily: "monospace", padding: "2px 7px", background: `${vc.frame}18`, border: `1px solid ${vc.frame}50`, color: vc.text, borderRadius: 3 }}>4W</span>
                <span style={{ fontSize: 8, fontFamily: "monospace", padding: "2px 7px", background: "transparent", border: "1px solid #21262d", color: "#4a4a4a", borderRadius: 3 }}>12W</span>
              </div>
            </div>
          </div>

          {/* Chart box */}
          <div style={{ margin: "5px 8px", borderRadius: 3, overflow: "hidden", border: "2px solid #0a0a0a" }}>
            <ProjectionChart
              history={priceHistory}
              verdict={verdict}
              sellWindow={projection?.key_signals?.find(s => s.toLowerCase().includes("sell window"))}
              width={cardWidth - 20}
              height={chartHeight}
            />
          </div>

          {/* Type line */}
          <div style={{ margin: "0 8px 4px", padding: "3px 8px", background: "rgba(0,0,0,0.4)", border: `1px solid ${vc.frame}30`, borderRadius: 2, fontSize: 8, color: `${vc.text}80`, display: "flex", justifyContent: "space-between" }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {projection ? `Sorcery — ${projection.key_signals[0] ?? "Market Analysis"}` : "Sorcery — Market Analysis"}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, color: rarity.color }}>{rarity.symbol}</span>
          </div>

          {/* Text box */}
          <div style={{ margin: "0 8px 5px", padding: "8px 9px", flex: 1, background: "rgba(0,0,0,0.3)", border: `2px solid ${vc.frame}30`, borderRadius: 3, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", fontSize: 28, fontWeight: 900, letterSpacing: "0.2em", color: `${vc.frame}06`, pointerEvents: "none", userSelect: "none" }}>
              INTEL
            </div>
            {projection ? (
              <>
                <div>
                  <div style={{ fontSize: textFontSize, fontWeight: 700, color: "#e6edf3", lineHeight: 1.4, position: "relative", zIndex: 1 }}>
                    {projection.key_signals.join(" · ")}
                  </div>
                  <div style={{ fontSize: textFontSize - 0.5, color: "#c9d1d9", lineHeight: 1.6, marginTop: 4, position: "relative", zIndex: 1 }}>
                    {projection.reasoning}
                  </div>
                </div>
                {projection.flavor_text && (
                  <div style={{ fontStyle: "italic", fontSize: textFontSize - 1, color: "#8b949e", borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 5, paddingTop: 5, lineHeight: 1.4, position: "relative", zIndex: 1 }}>
                    &ldquo;{projection.flavor_text}&rdquo;
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 9, color: "#6b7280", fontFamily: "monospace", textAlign: "center", position: "relative", zIndex: 1 }}>
                Loading projection…
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "3px 10px 7px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.5)", borderTop: "1px solid rgba(0,0,0,0.4)" }}>
            <div style={{ fontSize: 6.5, fontFamily: "monospace", color: `${vc.frame}70`, lineHeight: 1.5 }}>
              {projection ? `${projection.source === "algorithm" ? "⚙ algo" : "Claude"} · ${entry.set_code.toUpperCase()} #${entry.collector_number}` : ""}
              <br />
              Illus. Claude AI · ↺ refresh
            </div>
            <div style={{
              fontFamily: "Georgia,'Times New Roman',serif", fontWeight: 700, fontSize: 13,
              border: "2px solid #0a0a0a", borderRadius: 4, padding: "2px 7px",
              background: verdict === "BUY" ? "linear-gradient(135deg,#1a4a1a,#0d2e0d)" : verdict === "SELL" ? "linear-gradient(135deg,#7a1a1a,#4a0d0d)" : "linear-gradient(135deg,#7a5500,#4a3300)",
              color: vc.text,
              boxShadow: "inset 0 0 5px rgba(0,0,0,0.5)",
            }}>
              {projection ? `${Math.round(projection.confidence * 100)}%` : "—"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
