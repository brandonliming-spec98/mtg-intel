export const dynamic = "force-dynamic";

import { Flame, TrendingDown } from "lucide-react";
import type { SignalType } from "@/types";
import { HotCardRow } from "@/components/HotCardRow";

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
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/hot`, { next: { revalidate: 300 } });
  if (!res.ok) return { buy: [], sell: [] };
  return res.json();
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
