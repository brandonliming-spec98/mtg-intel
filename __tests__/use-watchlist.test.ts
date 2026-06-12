import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWatchlist } from "@/hooks/useWatchlist";
import type { WatchlistEntry } from "@/types";

const makeEntry = (id: string, status: WatchlistEntry["status"] = "watching"): WatchlistEntry => ({
  id,
  card_name: "Ragavan, Nimble Pilferer",
  set_code: "mh2",
  set_name: "Modern Horizons 2",
  collector_number: "138",
  finish: "nonfoil",
  image_uri: "https://cards.scryfall.io/normal/front/a/c/ragavan.jpg",
  status,
  added_at: "2026-06-11T00:00:00Z",
});

describe("useWatchlist", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
  });

  it("starts empty", () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });

  it("adds an entry", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).toBe("abc");
  });

  it("does not add duplicate ids", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.add(makeEntry("abc"));
      result.current.add(makeEntry("abc"));
    });
    expect(result.current.entries).toHaveLength(1);
  });

  it("removes an entry by id", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    act(() => result.current.remove("abc"));
    expect(result.current.entries).toEqual([]);
  });

  it("toggles status between watching and owned", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc", "watching")));
    act(() => result.current.toggleStatus("abc"));
    expect(result.current.entries[0].status).toBe("owned");
    act(() => result.current.toggleStatus("abc"));
    expect(result.current.entries[0].status).toBe("watching");
  });

  it("isWatched returns true for a known id", () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => result.current.add(makeEntry("abc")));
    expect(result.current.isWatched("abc")).toBe(true);
    expect(result.current.isWatched("unknown")).toBe(false);
  });

  it("persists to localStorage", () => {
    // Mock localStorage for this test
    const store: Record<string, string> = {};
    const mockLocalStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      clear: () => {
        Object.keys(store).forEach((key) => delete store[key]);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      key: (index: number) => Object.keys(store)[index] ?? null,
      length: () => Object.keys(store).length,
    };

    // Temporarily replace global localStorage
    const originalLS = global.localStorage;
    (global as any).localStorage = mockLocalStorage;

    try {
      const { result, unmount } = renderHook(() => useWatchlist());
      act(() => result.current.add(makeEntry("abc")));
      unmount();

      const { result: result2 } = renderHook(() => useWatchlist());
      expect(result2.current.entries).toHaveLength(1);
      expect(result2.current.entries[0].id).toBe("abc");
    } finally {
      (global as any).localStorage = originalLS;
    }
  });
});
