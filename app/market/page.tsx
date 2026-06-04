"use client";
import { useEffect, useState } from "react";
import MoverCard from "@/components/MoverCard";
import { MTGStocksInterest } from "@/types";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";

export default function MarketPage() {
  const [data, setData] = useState<{ average: MTGStocksInterest[]; foil: MTGStocksInterest[] }>({ average: [], foil: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"average" | "foil">("average");
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/movers");
      const json = await res.json();
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const movers = data[tab] ?? [];
  const gainers = movers.filter(m => m.percent > 0).sort((a, b) => b.percent - a.percent);
  const losers = movers.filter(m => m.percent < 0).sort((a, b) => a.percent - b.percent);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">Market Movers</h1>
          <p className="text-neutral text-sm">Cards with significant price movement · via MTGStocks</p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs font-mono text-neutral hidden md:block">
              Updated {lastUpdated}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-2.5 rounded-xl border border-bg-border text-neutral hover:text-gold hover:border-gold/30 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["average", "foil"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm font-mono px-4 py-2 rounded-lg border transition-all capitalize ${
              tab === t
                ? "bg-gold/15 text-gold border-gold/30"
                : "text-neutral border-bg-border hover:text-white"
            }`}
          >
            {t === "average" ? "📊 Regular" : "✨ Foil"}
          </button>
        ))}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid md:grid-cols-2 gap-6">
          {[0, 1].map(col => (
            <div key={col} className="space-y-3">
              <div className="skeleton h-6 w-28 rounded-lg" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* No data */}
      {!loading && movers.length === 0 && (
        <div className="text-center py-20">
          <div className="text-4xl mb-4">📡</div>
          <div className="font-display text-xl text-white mb-2">Market data unavailable</div>
          <p className="text-neutral text-sm">MTGStocks data couldn't be fetched right now. Try again shortly.</p>
        </div>
      )}

      {/* Gainers + Losers grid */}
      {!loading && movers.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {/* Gainers */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-bull" />
              <span className="text-sm font-mono font-bold text-bull uppercase tracking-wider">
                Top Gainers
              </span>
              <span className="text-xs font-mono text-neutral ml-auto">{gainers.length} cards</span>
            </div>
            <div className="space-y-2">
              {gainers.slice(0, 15).map((m, i) => (
                <MoverCard key={`${m.name}-${i}`} mover={m} rank={i + 1} />
              ))}
            </div>
          </div>

          {/* Losers */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown size={16} className="text-bear" />
              <span className="text-sm font-mono font-bold text-bear uppercase tracking-wider">
                Top Losers
              </span>
              <span className="text-xs font-mono text-neutral ml-auto">{losers.length} cards</span>
            </div>
            <div className="space-y-2">
              {losers.slice(0, 15).map((m, i) => (
                <MoverCard key={`${m.name}-${i}`} mover={m} rank={i + 1} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="mt-10 pt-6 border-t border-bg-border text-xs font-mono text-neutral text-center">
        Price data sourced from MTGStocks.com · Updates hourly · Not financial advice
      </div>
    </div>
  );
}
