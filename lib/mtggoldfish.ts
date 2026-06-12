import { PricePoint, CardPriceData, MTGStocksInterest, MTGStocksInterestsResponse } from "@/types";

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

// Daily movers scraped from the MTGGoldfish movers page, mapped into the
// interests shape the /market page already consumes (MTGStocks' API is gone).
export async function getMTGGoldfishMovers(): Promise<MTGStocksInterestsResponse> {
  const empty: MTGStocksInterestsResponse = { average: [], foil: [] };
  try {
    const res = await fetch("https://www.mtggoldfish.com/movers/paper/all", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return empty;

    let html = await res.text();
    // Only the Daily Change section; Weekly Change follows it on the page.
    const weeklyIdx = html.search(/Weekly Change/i);
    if (weeklyIdx > -1) html = html.slice(0, weeklyIdx);

    const rows = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
    const average: MTGStocksInterest[] = [];

    for (const [i, tr] of rows.entries()) {
      const card = tr.match(/data-card-id="([^"[]+?)\s*\[([^\]]+)\]"/);
      const change = tr.match(/class='(?:increase|decrease)'>([+-][\d.]+)</);
      const price = tr.match(/\$\s*([\d,.]+)/);
      const percent = tr.match(/class='(?:increase|decrease)'>([+-][\d.]+)%</);
      if (!card || !change || !price || !percent) continue;

      const newPrice = parseFloat(price[1].replace(/,/g, ""));
      // Special prints append an escaped variant uuid: "Name &lt;uuid&gt;"
      const name = card[1]
        .replace(/&lt;[^&]*&gt;/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .trim();
      average.push({
        name,
        id: i,
        print_id: i,
        percent: parseFloat(percent[1]),
        avg: newPrice,
        new_price: newPrice,
        old_price: Number((newPrice - parseFloat(change[1])).toFixed(2)),
        set_name: card[2],
      });
    }

    return { average, foil: [] };
  } catch {
    return empty;
  }
}
