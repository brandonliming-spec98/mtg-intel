"use client";

import { useState, useEffect } from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry, WatchlistFinish, WatchlistStatus } from "@/types";

interface ScryfallPrint {
  id: string;
  set_name: string;
  set: string;
  collector_number: string;
  released_at: string;
  finishes?: string[];
  image_uris?: { normal: string };
  card_faces?: Array<{ image_uris?: { normal: string } }>;
}

interface Props {
  cardName: string;
  defaultPrintId?: string;
  onClose: () => void;
}

function getImageUri(print: ScryfallPrint): string {
  return (
    print.image_uris?.normal ??
    print.card_faces?.[0]?.image_uris?.normal ??
    ""
  );
}

export default function WatchlistModal({ cardName, defaultPrintId, onClose }: Props) {
  const { add, isWatched } = useWatchlist();
  const [prints, setPrints] = useState<ScryfallPrint[]>([]);
  const [selectedPrintId, setSelectedPrintId] = useState(defaultPrintId ?? "");
  const [finish, setFinish] = useState<WatchlistFinish>("nonfoil");
  const [status, setStatus] = useState<WatchlistStatus>("watching");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const encoded = encodeURIComponent(`!"${cardName}"`);
    fetch(
      `https://api.scryfall.com/cards/search?q=${encoded}&unique=prints&order=released`
    )
      .then((r) => r.json())
      .then((json) => {
        const data: ScryfallPrint[] = json.data ?? [];
        setPrints(data);
        if (!defaultPrintId && data.length > 0) setSelectedPrintId(data[0].id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardName, defaultPrintId]);

  const selectedPrint = prints.find((p) => p.id === selectedPrintId);
  const availableFinishes = (selectedPrint?.finishes ?? ["nonfoil"]) as WatchlistFinish[];

  useEffect(() => {
    if (!availableFinishes.includes(finish)) {
      setFinish(availableFinishes[0] ?? "nonfoil");
    }
  }, [selectedPrintId]); // eslint-disable-line react-hooks/exhaustive-deps

  const entryId = `${selectedPrintId}_${finish}`;
  const alreadyWatched = isWatched(entryId);

  function handleAdd() {
    if (!selectedPrint) return;
    const year = selectedPrint.released_at?.slice(0, 4) ?? "";
    const entry: WatchlistEntry = {
      id: entryId,
      card_name: cardName,
      set_code: selectedPrint.set,
      set_name: `${selectedPrint.set_name} (${year})`,
      collector_number: selectedPrint.collector_number,
      finish,
      image_uri: getImageUri(selectedPrint),
      status,
      added_at: new Date().toISOString(),
    };
    add(entry);
    onClose();
  }

  const finishLabel: Record<WatchlistFinish, string> = {
    nonfoil: "Non-Foil",
    foil: "Foil",
    etched: "Foil Etched",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-bg-card border border-bg-border rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">Add to Watchlist</h2>
          <p className="text-neutral text-sm mt-0.5">{cardName}</p>
        </div>

        {loading ? (
          <div className="h-10 bg-bg-elevated animate-pulse rounded-lg" />
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                Printing
              </label>
              <select
                value={selectedPrintId}
                onChange={(e) => setSelectedPrintId(e.target.value)}
                className="w-full bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-gold/50"
              >
                {prints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.set_name} ({p.released_at?.slice(0, 4)}) · #{p.collector_number}
                  </option>
                ))}
              </select>
            </div>

            {availableFinishes.length > 1 && (
              <div className="space-y-1">
                <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                  Finish
                </label>
                <div className="flex gap-2">
                  {availableFinishes.map((f) => (
                    <button
                      key={f}
                      onClick={() => setFinish(f)}
                      className="flex-1 py-2 rounded-lg border text-xs font-mono transition-all"
                      style={
                        finish === f
                          ? { color: "#d4a843", background: "#d4a84318", borderColor: "#d4a84340" }
                          : { color: "#6b7280", background: "transparent", borderColor: "#21262d" }
                      }
                    >
                      {finishLabel[f]}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral">
                Status
              </label>
              <div className="flex gap-2">
                {(["watching", "owned"] as WatchlistStatus[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className="flex-1 py-3 rounded-lg border text-center transition-all"
                    style={
                      status === s
                        ? s === "watching"
                          ? { color: "#d4a843", background: "#d4a84318", borderColor: "#d4a84340" }
                          : { color: "#22c55e", background: "#22c55e18", borderColor: "#22c55e40" }
                        : { color: "#6b7280", background: "transparent", borderColor: "#21262d" }
                    }
                  >
                    <div className="text-lg">{s === "watching" ? "◎" : "●"}</div>
                    <div className="text-[11px] font-mono font-bold mt-1">
                      {s === "watching" ? "Watching" : "Own It"}
                    </div>
                    <div className="text-[9px] font-mono opacity-60 mt-0.5">
                      {s === "watching" ? "Monitor price" : "Track value"}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-bg-border text-neutral text-sm font-mono hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={!selectedPrint || alreadyWatched}
            className="flex-[2] py-2 rounded-lg text-sm font-mono font-bold transition-all disabled:opacity-40"
            style={{ background: "#d4a843", color: "#0a0a0f" }}
          >
            {alreadyWatched ? "Already Watched" : "Add to Watchlist"}
          </button>
        </div>
      </div>
    </div>
  );
}
