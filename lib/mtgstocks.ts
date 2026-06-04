import { MTGStocksInterestsResponse, PricePoint, CardPriceData, PriceSourceAdapter } from "@/types";

const BASE = "https://www.mtgstocks.com/api";
const HEADERS = {
  "User-Agent": "MTGIntel/1.0",
  "Accept": "application/json",
  "Referer": "https://www.mtgstocks.com/",
};

// Fetches the "interests" page — daily/weekly biggest movers
export async function getMTGStocksInterests(): Promise<MTGStocksInterestsResponse> {
  try {
    const res = await fetch(`${BASE}/interests/average`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`MTGStocks interests: ${res.status}`);
    return res.json();
  } catch {
    // Return empty on failure — prices from Scryfall still available
    return { average: [], foil: [] };
  }
}

// Search MTGStocks for a card by name
export async function searchMTGStocks(name: string): Promise<{ id: number; name: string; set: string }[]> {
  try {
    const encoded = encodeURIComponent(name);
    const res = await fetch(`${BASE}/cards/search/${encoded}`, {
      headers: HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

// Fetch price history for a specific print ID from MTGStocks
export async function getMTGStocksPriceHistory(printId: number): Promise<PricePoint[]> {
  try {
    const res = await fetch(`${BASE}/prints/${printId}`, {
      headers: HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();

    // MTGStocks returns price history as array of [timestamp_ms, price]
    const history: PricePoint[] = [];
    if (data?.prices?.avg && Array.isArray(data.prices.avg)) {
      for (const [ts, price] of data.prices.avg) {
        if (price !== null) {
          history.push({
            date: new Date(ts).toISOString().split("T")[0],
            price: Number(price),
            source: "mtgstocks",
          });
        }
      }
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

// Full price data for a card
export async function getCardPriceData(cardName: string): Promise<CardPriceData | null> {
  try {
    const results = await searchMTGStocks(cardName);
    if (!results.length) return null;

    // Use first result (most relevant print)
    const print = results[0];
    const history = await getMTGStocksPriceHistory(print.id);
    const latest = history[history.length - 1];

    return {
      cardName,
      currentPrice: latest?.price ?? null,
      currentFoilPrice: null,
      history,
      source: "mtgstocks",
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// ── TCGPlayer stub (activate in Phase 4) ────────────────────────────────────
export const tcgPlayerAdapter: PriceSourceAdapter = {
  name: "TCGPlayer",
  enabled: false,
  async fetchPrice(_cardName: string, _setCode?: string) {
    // TODO Phase 4: implement with TCGPlayer Partner API
    // Requires: API key from developer.tcgplayer.com
    console.warn("TCGPlayer adapter not yet enabled");
    return null;
  },
  async fetchHistory(_cardName: string, _setCode?: string) {
    return [];
  },
};
