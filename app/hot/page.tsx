import { Flame, TrendingDown, AlertTriangle, Tag, Zap, BarChart2 } from "lucide-react";
import type { SignalType } from "@/types";

interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

interface HotData {
  buy: HotCard[];
  sell: HotCard[];
}

async function getHotData(): Promise<HotData> {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/hot`, { next: { revalidate: 300 } });
  if (!res.ok) return { buy: [], sell: [] };
  return res.json();
}

// ── Signal type metadata ──────────────────────────────────────────────────────

const SIGNAL_META: Record<SignalType, { label: string; icon: React.ReactNode; color: string }> = {
  buy_hype:             { label: "Spiking",          icon: <Zap size={11} />,          color: "text-gold border-gold/30 bg-gold/10" },
  format_staple:        { label: "Format Staple",    icon: <BarChart2 size={11} />,     color: "text-emerald-400 border-emerald-400/30 bg-emerald-400/10" },
  reprint_announced:    { label: "Reprint",           icon: <Tag size={11} />,           color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  price_peak:           { label: "At Peak",           icon: <TrendingDown size={11} />,  color: "text-red-400 border-red-400/30 bg-red-400/10" },
  ban_risk:             { label: "Ban Risk",          icon: <AlertTriangle size={11} />, color: "text-red-400 border-red-400/30 bg-red-400/10" },
  set_release_pressure: { label: "Set Pressure",     icon: <TrendingDown size={11} />,  color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  general:              { label: "Mentioned",         icon: <Zap size={11} />,           color: "text-neutral border-bg-border bg-bg-elevated" },
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

function HotCardRow({ card, direction }: { card: HotCard; direction: "buy" | "sell" }) {
  return (
    <a
      href={`/search?q=${encodeURIComponent(card.card_name)}`}
      className="group flex items-start gap-4 p-4 rounded-xl border border-bg-border hover:border-gold/30 hover:bg-bg-elevated/50 transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-sm font-bold text-text-primary truncate">{card.card_name}</span>
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
    </a>
  );
}

function Section({
  title,
  icon,
  cards,
  direction,
  emptyMsg,
}: {
  title: string;
  icon: React.ReactNode;
  cards: HotCard[];
  direction: "buy" | "sell";
  emptyMsg: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-text-primary">{title}</h2>
        <span className="text-xs font-mono text-neutral/50 ml-auto">{cards.length} cards</span>
      </div>
      {cards.length === 0 ? (
        <p className="text-xs text-neutral/50 py-6 text-center border border-dashed border-bg-border rounded-xl">{emptyMsg}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {cards.slice(0, 20).map((card) => (
            <HotCardRow key={card.card_name} card={card} direction={direction} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function HotCardsPage() {
  const { buy, sell } = await getHotData();

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 space-y-10">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Flame size={20} className="text-gold" />
          <h1 className="text-xl font-bold text-text-primary">Hot Cards</h1>
        </div>
        <p className="text-sm text-neutral/70">
          Buy and sell signals from the last 7 days — ranked by community momentum.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Section
          title="Buy Signals"
          icon={<Flame size={14} className="text-gold" />}
          cards={buy}
          direction="buy"
          emptyMsg="No strong buy signals in the last 7 days."
        />
        <Section
          title="Sell Signals"
          icon={<TrendingDown size={14} className="text-red-400" />}
          cards={sell}
          direction="sell"
          emptyMsg="No sell signals in the last 7 days."
        />
      </div>
    </main>
  );
}
