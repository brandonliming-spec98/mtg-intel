"use client";

import { useState } from "react";
import { useWatchlist } from "@/hooks/useWatchlist";
import WatchlistModal from "./WatchlistModal";
import type { WatchlistEntry } from "@/types";

interface Props {
  cardName: string;
  defaultEntry?: Omit<WatchlistEntry, "status" | "added_at">;
  className?: string;
  size?: "sm" | "md";
}

export default function WatchButton({ cardName, defaultEntry, className = "", size = "md" }: Props) {
  const { isWatched, remove } = useWatchlist();
  const [open, setOpen] = useState(false);

  const watched = defaultEntry
    ? isWatched(`${defaultEntry.id}_${defaultEntry.finish}`)
    : false;

  function handleClick() {
    if (watched && defaultEntry) {
      remove(`${defaultEntry.id}_${defaultEntry.finish}`);
    } else {
      setOpen(true);
    }
  }

  const star = watched ? "★" : "☆";
  const label = watched ? "Watching" : "Watch";
  const sizeClass = size === "sm"
    ? "text-xs px-2 py-1 gap-1"
    : "text-sm px-3 py-2 gap-2";

  return (
    <>
      <button
        onClick={handleClick}
        className={`flex items-center border rounded-xl font-mono transition-all ${sizeClass} ${
          watched
            ? "border-gold/40 text-gold bg-gold/10 hover:bg-gold/20"
            : "border-bg-border text-neutral hover:text-gold hover:border-gold/30"
        } ${className}`}
        title={watched ? "Remove from watchlist" : "Add to watchlist"}
      >
        <span>{star}</span>
        <span>{label}</span>
      </button>

      {open && (
        <WatchlistModal
          cardName={cardName}
          defaultPrintId={defaultEntry?.id}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
