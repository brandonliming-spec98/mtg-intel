import { PricePoint, CardPriceData } from "@/types";

// MTGGoldfish provides price data via their public price pages
// We parse the JSON data embedded in their HTML

export async function getMTGGoldfishPrice(cardName: string): Promise<CardPriceData | null> {
  try {
    const encoded = encodeURIComponent(cardName);
    const res = await fetch(`https://www.mtggoldfish.com/price/${encoded}#paper`, {
      headers: { "User-Agent": "MTGIntel/1.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;

    const html = await res.text();

    // MTGGoldfish embeds price data as: data-price="XX.XX"
    const priceMatch = html.match(/class="price-box-price[^"]*"[^>]*>([\d,.]+)</);
    const currentPrice = priceMatch ? parseFloat(priceMatch[1].replace(",", "")) : null;

    return {
      cardName,
      currentPrice,
      currentFoilPrice: null,
      history: [], // Full history requires individual chart pages
      source: "mtggoldfish",
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

// Fetch MTGGoldfish trending/movers for the market dashboard
export async function getMTGGoldfishTrending(): Promise<Array<{
  name: string;
  setCode: string;
  price: number;
  change: number;
}>> {
  try {
    const res = await fetch("https://www.mtggoldfish.com/", {
      headers: { "User-Agent": "MTGIntel/1.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    // Parse trending cards from homepage — returns minimal data
    // Full implementation extracts the "Price Changes" table
    return [];
  } catch {
    return [];
  }
}
