"use client";

import { useState, useEffect, useCallback } from "react";
import type { WatchlistEntry } from "@/types";

const STORAGE_KEY = "mtgintel_watchlist";

function readStorage(): WatchlistEntry[] {
  try {
    if (typeof localStorage === "undefined") return [];
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeStorage(entries: WatchlistEntry[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silently ignore localStorage errors in test environments
  }
}

export interface UseWatchlist {
  entries: WatchlistEntry[];
  add: (entry: WatchlistEntry) => void;
  remove: (id: string) => void;
  toggleStatus: (id: string) => void;
  isWatched: (id: string) => boolean;
}

export function useWatchlist(): UseWatchlist {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    setEntries(readStorage());
  }, []);

  const add = useCallback(
    (entry: WatchlistEntry) => {
      setEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev;
        const next = [...prev, entry];
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const remove = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== id);
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const toggleStatus = useCallback(
    (id: string) => {
      setEntries((prev) => {
        const next = prev.map((e) =>
          e.id === id
            ? { ...e, status: e.status === "watching" ? "owned" : "watching" as WatchlistEntry["status"] }
            : e
        );
        writeStorage(next);
        return next;
      });
    },
    []
  );

  const isWatched = useCallback(
    (id: string) => entries.some((e) => e.id === id),
    [entries]
  );

  return { entries, add, remove, toggleStatus, isWatched };
}
