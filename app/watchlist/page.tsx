"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/types";

interface PriceRow {
  currentPrice: number | null;
  delta7d: number | null;
}

const FINISH_LABEL: Record<WatchlistEntry["finish"], string> = {
  nonfoil: "Non-Foil",
  foil: "Foil",
  etched: "Foil Etched",
};

function usePrices(entries: WatchlistEntry[]) {
  const [prices, setPrices] = useState<Record<string, PriceRow>>({});

  useEffect(() => {
    if (entries.length === 0) return;
    const names = [...new Set(entries.map((e) => e.card_name))];
    names.forEach((name) => {
      fetch(`/api/prices?name=${encodeURIComponent(name)}`)
        .then((r) => r.json())
        .then((data) => {
          const current: number | null = data.currentPrice ?? null;
          const history: Array<{ price: number }> = data.history ?? [];
          const weekAgo = history.length > 7 ? history[history.length - 8]?.price ?? null : null;
          const delta7d =
            current !== null && weekAgo !== null && weekAgo > 0
              ? ((current - weekAgo) / weekAgo) * 100
              : null;
          setPrices((prev) => ({ ...prev, [name]: { currentPrice: current, delta7d } }));
        })
        .catch(() => {});
    });
  }, [entries]);

  return prices;
}

function EntryRow({
  entry,
  price,
  onRemove,
  onToggle,
}: {
  entry: WatchlistEntry;
  price: PriceRow | undefined;
  onRemove: () => void;
  onToggle: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-3 flex gap-3 items-center relative">
      {entry.image_uri ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={entry.image_uri}
          alt={entry.card_name}
          className="w-8 h-11 rounded object-cover flex-shrink-0"
          style={{ border: "1px solid rgba(212,175,55,0.2)" }}
        />
      ) : (
        <div
          className="w-8 h-11 rounded flex-shrink-0 flex items-center justify-center text-sm"
          style={{
            background: "linear-gradient(135deg,#1a1a2e,#0f3460)",
            border: "1px solid rgba(212,175,55,0.2)",
          }}
        >
          🃏
        </div>
      )}

      <div className="flex-1 min-w-0">
        <Link
          href={`/cards/${entry.id.split("_")[0]}`}
          className="text-gold font-bold text-sm hover:text-gold-light transition-colors block truncate"
        >
          {entry.card_name}
        </Link>
        <div className="text-neutral text-[10px] font-mono mt-0.5">
          {entry.set_name} · {FINISH_LABEL[entry.finish]} · #{entry.collector_number}
        </div>
      </div>

      <div className="text-right flex-shrink-0 mr-2">
        {price?.currentPrice != null ? (
          <>
            <div className="text-white font-mono font-bold text-sm">
              ${price.currentPrice.toFixed(2)}
            </div>
            {price.delta7d !== null && (
              <div
                className="text-[10px] font-mono"
                style={{ color: price.delta7d >= 0 ? "#22c55e" : "#ef4444" }}
              >
                {price.delta7d >= 0 ? "+" : ""}
                {price.delta7d.toFixed(1)}% 7d
              </div>
            )}
          </>
        ) : (
          <div className="text-neutral font-mono text-sm">—</div>
        )}
      </div>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="text-neutral hover:text-white p-1 transition-colors"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div
            className="absolute right-0 top-7 z-10 bg-bg-card border border-bg-border rounded-xl py-1 w-40 shadow-lg"
            onBlur={() => setMenuOpen(false)}
          >
            <button
              onClick={() => { onToggle(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-neutral hover:text-white hover:bg-bg-elevated transition-all font-mono"
            >
              {entry.status === "watching" ? "Mark as Owned" : "Mark as Watching"}
            </button>
            <button
              onClick={() => { onRemove(); setMenuOpen(false); }}
              className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-bg-elevated transition-all font-mono"
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function WatchlistPage() {
  const { entries, remove, toggleStatus } = useWatchlist();
  const prices = usePrices(entries);

  const owned = entries.filter((e) => e.status === "owned");
  const watching = entries.filter((e) => e.status === "watching");

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Bookmark size={20} className="text-gold" />
        <div>
          <h1 className="font-display text-2xl font-bold text-white">My Watchlist</h1>
          <p className="text-neutral text-xs font-mono mt-0.5">
            {entries.length} card{entries.length !== 1 ? "s" : ""} tracked · prices updated live
          </p>
        </div>
      </div>

      {entries.length === 0 && (
        <div className="bg-bg-card border border-bg-border rounded-2xl p-10 text-center">
          <Bookmark size={28} className="text-gold mx-auto mb-3" />
          <h3 className="font-display text-lg font-bold text-white mb-2">Nothing here yet</h3>
          <p className="text-neutral text-sm max-w-xs mx-auto">
            Use the ☆ Watch button on any card detail page or the Hot Cards dashboard to start tracking.
          </p>
          <p className="text-neutral/40 text-xs font-mono mt-4">
            iOS 16.4+ required for push notifications · Add to Home Screen
          </p>
        </div>
      )}

      {owned.length > 0 && (
        <section className="mb-8">
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-green-400 mb-3">
            ● Own It ({owned.length})
          </div>
          <div className="flex flex-col gap-2">
            {owned.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                price={prices[e.card_name]}
                onRemove={() => remove(e.id)}
                onToggle={() => toggleStatus(e.id)}
              />
            ))}
          </div>
        </section>
      )}

      {watching.length > 0 && (
        <section>
          <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-gold mb-3">
            ◎ Watching ({watching.length})
          </div>
          <div className="flex flex-col gap-2">
            {watching.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                price={prices[e.card_name]}
                onRemove={() => remove(e.id)}
                onToggle={() => toggleStatus(e.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
