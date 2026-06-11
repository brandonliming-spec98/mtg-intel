"use client";
import { useState } from "react";
import type { IntelSignal } from "@/types";
import ScoreRing from "./ScoreRing";

interface SubScores {
  volume: number;
  sentiment: number;
  momentum: number;
  scarcity: number;
}

interface Props {
  signals: IntelSignal[];
  score: number;
  subScores: SubScores;
}

const SOURCE_LABEL: Record<string, string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  news: "News",
  mtggoldfish: "MTGGoldfish",
};

function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const fill = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color = fill >= 50 ? "#22c55e" : "#ef4444";
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-neutral font-mono text-[9px]">{label}</span>
        <span className="text-white font-mono text-[9px]">
          {value}/{max}
        </span>
      </div>
      <div style={{ background: "#21262d", borderRadius: 2, height: 4 }}>
        <div
          style={{
            width: `${fill}%`,
            height: 4,
            borderRadius: 2,
            background: color,
          }}
        />
      </div>
    </div>
  );
}

export default function IntelPanel({ signals, score, subScores }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (signals.length === 0) {
    return (
      <div className="bg-bg-card border border-bg-border rounded-2xl p-5 font-mono text-neutral text-sm text-center py-10">
        No signals yet — check back after the next ingest.
      </div>
    );
  }

  const shown = expanded ? signals : signals.slice(0, 4);
  const remaining = signals.length - 4;

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-5 space-y-5">
      {/* Score block */}
      <div className="flex items-start gap-4">
        <ScoreRing score={score} />
        <div className="flex-1 space-y-2.5">
          <BarRow label="Mention Volume" value={subScores.volume} max={35} />
          <BarRow label="Sentiment" value={subScores.sentiment} max={30} />
          <BarRow label="Price Momentum" value={subScores.momentum} max={20} />
          <BarRow label="Supply Scarcity" value={subScores.scarcity} max={15} />
        </div>
      </div>

      {/* Quote feed */}
      <div>
        <div className="text-[9px] font-mono text-neutral uppercase tracking-[0.08em] mb-3">
          Sources
        </div>
        <div className="space-y-2">
          {shown.map((s) => {
            const isBull = s.sentiment === "bullish";
            const color = isBull ? "#22c55e" : "#ef4444";
            return (
              <div
                key={s.id}
                style={{
                  background: "#161b22",
                  borderLeft: `2px solid ${color}`,
                  borderRadius: "0 4px 4px 0",
                  padding: "7px 10px",
                }}
              >
                <div className="text-neutral font-mono text-[8px] mb-1">
                  {SOURCE_LABEL[s.source_type] ?? s.source_type} ·{" "}
                  {s.signal_strength}/10
                </div>
                <div className="text-white text-[9px] leading-relaxed line-clamp-2">
                  &ldquo;{s.summary}&rdquo;
                </div>
              </div>
            );
          })}
        </div>
        {remaining > 0 && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="text-[#58a6ff] font-mono text-[9px] mt-3 hover:underline block"
          >
            + {remaining} more sources
          </button>
        )}
      </div>
    </div>
  );
}
