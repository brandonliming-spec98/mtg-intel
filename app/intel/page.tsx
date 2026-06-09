"use client";

import { useEffect, useState } from "react";
import { Zap, RefreshCw } from "lucide-react";
import SignalCard from "@/components/SignalCard";
import type { IntelSignal } from "@/types";

function topCardBySignals(signals: IntelSignal[]): string {
  const counts = signals.reduce<Record<string, number>>((acc, s) => {
    acc[s.card_name_raw] = (acc[s.card_name_raw] ?? 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "—";
}

export default function IntelPage() {
  const [signals, setSignals] = useState<IntelSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/intel?limit=50");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setSignals(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load signals");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const bullish  = signals.filter((s) => s.sentiment === "bullish");
  const bearish  = signals.filter((s) => s.sentiment === "bearish");
  const topCard  = topCardBySignals(signals);
  const lastIngest = signals[0]
    ? new Date(signals[0].published_at).toLocaleDateString()
    : "—";

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-3xl font-bold text-white mb-1">
            Intelligence Feed
          </h1>
          <p className="text-neutral text-sm">
            AI-analyzed signals from YouTube, Reddit, and MTG news
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 border border-bg-border text-neutral hover:text-white hover:border-gold/30 transition-all rounded-xl px-3 py-2 text-sm font-mono flex-shrink-0 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {signals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Signals Today", value: signals.length,    color: "#d4a843" },
            { label: "Bullish",       value: bullish.length,    color: "#22c55e" },
            { label: "Bearish",       value: bearish.length,    color: "#ef4444" },
            { label: "Last Ingested", value: lastIngest,        color: "#a855f7" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-bg-card border border-bg-border rounded-xl p-3 text-center"
            >
              <div className="font-mono font-bold text-xl" style={{ color }}>{value}</div>
              <div className="text-neutral text-xs mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && signals.length === 0 && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-bg-card border border-bg-border rounded-xl p-4 animate-pulse h-[88px]"
            />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-bg-card border border-red-500/20 rounded-xl p-6 text-center mb-6">
          <p className="text-red-400 text-sm mb-3">{error}</p>
          <p className="text-neutral text-xs">
            Make sure your Supabase env vars are configured and the migration has been run.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && signals.length === 0 && (
        <div className="bg-bg-card border border-bg-border rounded-2xl p-10 text-center">
          <Zap size={32} className="text-gold mx-auto mb-4" />
          <h3 className="font-display text-lg font-bold text-white mb-2">No signals yet</h3>
          <p className="text-neutral text-sm max-w-sm mx-auto">
            Trigger the Reddit ingestion endpoint to start populating signals, or wait for the
            scheduled cron job.
          </p>
          <code className="block mt-4 text-xs font-mono text-neutral/60 bg-bg-elevated border border-bg-border rounded-lg p-3">
            POST /api/ingest/reddit
          </code>
        </div>
      )}

      {/* Feed */}
      {signals.length > 0 && (
        <>
          {topCard !== "—" && (
            <p className="text-neutral text-xs font-mono mb-3">
              Top card:{" "}
              <span style={{ color: "#a855f7" }}>{topCard}</span>
            </p>
          )}
          <div className="flex flex-col gap-3">
            {signals.map((signal, i) => {
              const momentum = Math.min(100, signal.signal_strength * 10);
              return (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  momentumScore={momentum}
                  listIndex={i}
                />
              );
            })}
          </div>
          {lastUpdated && (
            <p className="text-center text-neutral/40 text-xs font-mono mt-6">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </>
      )}
    </div>
  );
}
