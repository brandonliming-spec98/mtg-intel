"use client";

import WatchButton from "./WatchButton";
import type { SignalType } from "@/types";
import { Zap, TrendingDown, AlertTriangle, Tag, BarChart2 } from "lucide-react";

interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

const SIGNAL_META: Record<SignalType, { label: string; icon: React.ReactNode; color: string }> = {
  buy_hype:             { label: "Spiking",       icon: <Zap size={11} />,          color: "text-gold border-gold/30 bg-gold/10" },
  format_staple:        { label: "Format Staple", icon: <BarChart2 size={11} />,     color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  reprint_announced:    { label: "Reprint",        icon: <Tag size={11} />,           color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  price_peak:           { label: "At Peak",        icon: <TrendingDown size={11} />,  color: "text-red-400 border-red-400/30 bg-red-400/10" },
  ban_risk:             { label: "Ban Risk",       icon: <AlertTriangle size={11} />, color: "text-red-400 border-red-400/30 bg-red-400/10" },
  set_release_pressure: { label: "Set Pressure",  icon: <TrendingDown size={11} />,  color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  general:              { label: "Mentioned",      icon: <Zap size={11} />,           color: "text-neutral border-bg-border bg-bg-elevated" },
};

function SignalBadge({ type }: { type: SignalType }) {
  const meta = SIGNAL_META[type] ?? SIGNAL_META.general;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border ${meta.color}`}>
      {meta.icon}{meta.label}
    </span>
  );
}

function StrengthBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1 bg-bg-elevated rounded-full overflow-hidden">
        <div className="h-full bg-gold rounded-full" style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-[10px] font-mono text-neutral/60">{value.toFixed(1)}</span>
    </div>
  );
}

function SellWindowChip({ date }: { date: string }) {
  const d = new Date(date);
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const daysUntil = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const urgent = daysUntil <= 14;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-lg border ${
      urgent ? "text-red-400 border-red-400/40 bg-red-400/10" : "text-orange-300 border-orange-400/30 bg-orange-400/8"
    }`}>
      Sell by {formatted}{urgent && " ⚡"}
    </span>
  );
}

export function HotCardRow({ card, direction }: { card: HotCard; direction: "buy" | "sell" }) {
  return (
    <div className="group flex items-start gap-4 p-4 rounded-xl border border-bg-border hover:border-gold/30 hover:bg-bg-elevated/50 transition-all">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <a
            href={`/search?q=${encodeURIComponent(card.card_name)}`}
            className="text-sm font-bold text-text-primary truncate hover:text-gold transition-colors"
          >
            {card.card_name}
          </a>
          <SignalBadge type={card.signal_type} />
          {card.sell_window && direction === "sell" && <SellWindowChip date={card.sell_window} />}
        </div>
        {card.summaries[0] && (
          <p className="text-xs text-neutral/70 leading-relaxed line-clamp-2">{card.summaries[0]}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <StrengthBar value={card.avg_strength} />
          <span className="text-[10px] font-mono text-neutral/50">
            {card.signal_count} signal{card.signal_count !== 1 ? "s" : ""} · {new Date(card.latest_signal).toLocaleDateString()}
          </span>
        </div>
      </div>
      <WatchButton cardName={card.card_name} size="sm" />
    </div>
  );
}
