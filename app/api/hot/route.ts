import { NextResponse } from "next/server";
import { fetchSignals } from "@/lib/supabase-signals";
import type { IntelSignal, SignalType } from "@/types";

const SELL_TYPES: SignalType[] = ["reprint_announced", "price_peak", "ban_risk", "set_release_pressure"];
const BUY_TYPES: SignalType[] = ["buy_hype", "format_staple"];

interface HotCard {
  card_name: string;
  signal_count: number;
  signal_type: SignalType;
  avg_strength: number;
  latest_signal: string;
  sell_window: string | null;
  summaries: string[];
}

function isSell(s: IntelSignal): boolean {
  return s.sentiment === "bearish" || (s.signal_type != null && SELL_TYPES.includes(s.signal_type));
}

function isBuy(s: IntelSignal): boolean {
  return s.sentiment === "bullish" || (s.signal_type != null && BUY_TYPES.includes(s.signal_type));
}

function aggregate(signals: IntelSignal[]): HotCard[] {
  const map = new Map<string, IntelSignal[]>();
  for (const s of signals) {
    const key = s.card_name_raw.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  return [...map.entries()].map(([, group]) => {
    const sorted = [...group].sort(
      (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
    );
    const windows = group
      .map((s) => s.sell_window)
      .filter((w): w is string => !!w)
      .sort();

    return {
      card_name: sorted[0].card_name_raw,
      signal_count: group.length,
      signal_type: sorted[0].signal_type ?? "general",
      avg_strength: Math.round((group.reduce((s, g) => s + g.signal_strength, 0) / group.length) * 10) / 10,
      latest_signal: sorted[0].published_at,
      sell_window: windows[0] ?? null,
      summaries: [...new Set(group.map((s) => s.summary))].slice(0, 3),
    };
  });
}

export async function GET() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const signals = await fetchSignals({ after: since.toISOString() });

    const buySignals = signals.filter(isBuy);
    const sellSignals = signals.filter(isSell);

    const buy = aggregate(buySignals).sort((a, b) => b.signal_count - a.signal_count);
    const sell = aggregate(sellSignals).sort((a, b) => {
      // Sort sell cards: those with imminent sell_window first, then by signal count
      if (a.sell_window && b.sell_window) return a.sell_window.localeCompare(b.sell_window);
      if (a.sell_window) return -1;
      if (b.sell_window) return 1;
      return b.signal_count - a.signal_count;
    });

    return NextResponse.json({ buy, sell });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
