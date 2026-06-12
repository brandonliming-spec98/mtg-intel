import { describe, it, expect, vi, beforeEach } from "vitest";

// Reset module between tests so the module-level cache is cleared
beforeEach(() => {
  vi.resetModules();
});

describe("getCardCatalog", () => {
  it("fetches from Scryfall and returns a Set of card names", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: ["Ragavan, Nimble Pilferer", "Black Lotus", "Lightning Bolt"] }),
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    const catalog = await getCardCatalog();

    // Scryfall 400s requests without a User-Agent and Accept header
    expect(fetch).toHaveBeenCalledWith(
      "https://api.scryfall.com/catalog/card-names",
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json" }),
      })
    );
    expect(catalog).toBeInstanceOf(Set);
    expect(catalog.has("Ragavan, Nimble Pilferer")).toBe(true);
    expect(catalog.has("Black Lotus")).toBe(true);
    expect(catalog.size).toBe(3);
  });

  it("returns cached Set on second call without fetching again", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: ["Ragavan, Nimble Pilferer"] }),
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    await getCardCatalog();
    await getCardCatalog();

    expect(fetch).toHaveBeenCalledOnce();
  });

  it("throws when Scryfall returns a non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    const { getCardCatalog } = await import("@/lib/scryfall-catalog");
    await expect(getCardCatalog()).rejects.toThrow("Scryfall catalog fetch failed: 503");
  });
});
