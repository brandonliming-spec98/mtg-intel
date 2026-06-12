import { describe, it, expect, vi } from "vitest";
import { recordSnapshot, getPriceHistory } from "@/lib/price-history";

function mockClient(opts: {
  existingToday?: boolean;
  rows?: { price_usd: string; recorded_at: string }[];
}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const limit = vi.fn().mockResolvedValue({
    data: opts.existingToday ? [{ id: "x" }] : [],
    error: null,
  });
  const order = vi.fn().mockResolvedValue({ data: opts.rows ?? [], error: null });

  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit,
    order,
    insert,
  };
  return { client: { from: vi.fn().mockReturnValue(chain) }, chain, insert };
}

describe("recordSnapshot", () => {
  it("inserts a snapshot when none exists for today", async () => {
    const { client, insert } = mockClient({ existingToday: false });

    await recordSnapshot("Sol Ring", 12.34, 45.0, client);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        card_name: "Sol Ring",
        price_usd: 12.34,
        price_usd_foil: 45.0,
        source: "scryfall",
      })
    );
  });

  it("skips the insert when a snapshot already exists today", async () => {
    const { client, insert } = mockClient({ existingToday: true });

    await recordSnapshot("Sol Ring", 12.34, null, client);

    expect(insert).not.toHaveBeenCalled();
  });
});

describe("getPriceHistory", () => {
  it("maps snapshot rows to PricePoints", async () => {
    const { client } = mockClient({
      rows: [
        { price_usd: "10.00", recorded_at: "2026-06-10T12:00:00+00:00" },
        { price_usd: "12.50", recorded_at: "2026-06-11T12:00:00+00:00" },
      ],
    });

    const history = await getPriceHistory("Sol Ring", 180, client);

    expect(history).toEqual([
      { date: "2026-06-10", price: 10.0, source: "snapshot" },
      { date: "2026-06-11", price: 12.5, source: "snapshot" },
    ]);
  });

  it("returns empty array when the query errors", async () => {
    const insert = vi.fn();
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order,
      insert,
    };
    const client = { from: vi.fn().mockReturnValue(chain) };

    const history = await getPriceHistory("Sol Ring", 180, client);

    expect(history).toEqual([]);
  });
});
