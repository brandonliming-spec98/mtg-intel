"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bookmark, MoreHorizontal } from "lucide-react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry, Projection, PricePoint } from "@/types";
import ProjectionFlipCard from "@/components/ProjectionFlipCard";

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

function ProjectionsTab({ entries }: { entries: WatchlistEntry[] }) {
  const [projections, setProjections] = useState<Record<string, Projection>>({});
  const [histories, setHistories] = useState<Record<string, PricePoint[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (entries.length === 0) {
      setLoading(false);
      return;
    }
    const unique = [...new Set(entries.map((e) => e.card_name))];

    Promise.all(
      unique.map((name) =>
        Promise.all([
          fetch(`/api/projections/${encodeURIComponent(name)}`).then((r) =>
            r.ok ? (r.json() as Promise<Projection>) : null
          ),
          fetch(`/api/prices?name=${encodeURIComponent(name)}`).then((r) =>
            r.ok ? r.json() : null
          ),
        ]).then(([proj, price]) => ({ name, proj, price }))
      )
    )
      .then((results) => {
        const newProj: Record<string, Projection> = {};
        const newHist: Record<string, PricePoint[]> = {};
        for (const { name, proj, price } of results) {
          if (proj) newProj[name] = proj;
          if (price?.history) newHist[name] = price.history;
        }
        setProjections(newProj);
        setHistories(newHist);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-neutral text-sm font-mono">
        Loading projections…
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-16 text-neutral text-sm font-mono">
        Add cards to your watchlist to see projections.
      </div>
    );
  }

  const buy  = entries.filter((e) => projections[e.card_name]?.verdict === "BUY");
  const hold = entries.filter((e) => projections[e.card_name]?.verdict === "HOLD");
  const sell = entries.filter((e) => projections[e.card_name]?.verdict === "SELL");

  function Section({
    label, color, symbol, cards,
  }: { label: string; color: string; symbol: string; cards: WatchlistEntry[] }) {
    return (
      <div className="mb-8">
        <div style={{ color }} className="text-xs font-mono font-bold tracking-widest uppercase mb-3">
          {symbol} {label} ({cards.length})
        </div>
        {cards.length === 0 ? (
          <div
            className="border border-dashed rounded text-center py-4 text-xs font-serif italic text-neutral"
            style={{ borderColor: "#21262d" }}
          >
            No {label.toLowerCase()} recommendations right now.
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {cards.map((entry) => (
              <ProjectionFlipCard
                key={entry.id}
                entry={entry}
                projection={projections[entry.card_name] ?? null}
                priceHistory={histories[entry.card_name] ?? []}
                size="sm"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <Section label="BUY"  color="#22c55e" symbol="●" cards={buy} />
      <Section label="HOLD" color="#d4a843" symbol="◎" cards={hold} />
      <Section label="SELL" color="#ef4444" symbol="✕" cards={sell} />
    </div>
  );
}

export default function WatchlistPage() {
  const { entries, remove, toggleStatus } = useWatchlist();
  const prices = usePrices(entries);
  const [tab, setTab] = useState<"list" | "projections">("list");

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

      {entries.length > 0 && (
        <div className="flex gap-1 mb-5 border-b pb-3" style={{ borderColor: "#21262d" }}>
          <button
            onClick={() => setTab("list")}
            className="text-xs font-mono px-3 py-1.5 rounded border transition-colors"
            style={
              tab === "list"
                ? { borderColor: "rgba(212,168,67,0.6)", color: "#d4a843", background: "rgba(212,168,67,0.1)" }
                : { borderColor: "#21262d", color: "#6b7280", background: "transparent" }
            }
          >
            List
          </button>
          <button
            onClick={() => setTab("projections")}
            className="text-xs font-mono px-3 py-1.5 rounded border transition-colors"
            style={
              tab === "projections"
                ? { borderColor: "rgba(212,168,67,0.6)", color: "#d4a843", background: "rgba(212,168,67,0.1)" }
                : { borderColor: "#21262d", color: "#6b7280", background: "transparent" }
            }
          >
            ✦ Projections
          </button>
        </div>
      )}

      {tab === "projections" ? (
        <ProjectionsTab entries={entries} />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
