import { describe, it, expect, vi, beforeEach } from "vitest";
import { getScryfallPriceData } from "@/lib/scryfall";

const namedCard = (prices: Record<string, string | null>) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({
    name: "Sol Ring",
    prices,
  }),
});

const printsResult = (usdPrices: (string | null)[]) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({
    data: usdPrices.map((usd, i) => ({
      name: "Sol Ring",
      set: `set${i}`,
      prices: { usd, usd_foil: null },
    })),
  }),
});

describe("getScryfallPriceData", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("returns the named card's price when available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(namedCard({ usd: "12.34", usd_foil: "45.00" }))
    );

    const data = await getScryfallPriceData("Sol Ring");

    expect(data).toMatchObject({
      cardName: "Sol Ring",
      currentPrice: 12.34,
      currentFoilPrice: 45.0,
      source: "scryfall",
    });
  });

  it("falls back to the cheapest priced print when the named card has no price", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(namedCard({ usd: null, usd_foil: null }))
        .mockResolvedValueOnce(printsResult([null, "99.99", "1.49", "5.00"]))
    );

    const data = await getScryfallPriceData("Sol Ring");

    expect(data?.currentPrice).toBe(1.49);
    expect(data?.source).toBe("scryfall");
  });

  it("returns null when no print has a price", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(namedCard({ usd: null, usd_foil: null }))
        .mockResolvedValueOnce(printsResult([null, null]))
    );

    const data = await getScryfallPriceData("Sol Ring");

    expect(data).toBeNull();
  });

  it("returns null when the card lookup fails entirely", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404 })
    );

    const data = await getScryfallPriceData("Not A Real Card");

    expect(data).toBeNull();
  });
});
