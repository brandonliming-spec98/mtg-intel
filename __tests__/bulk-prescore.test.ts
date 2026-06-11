import { describe, it, expect, vi } from "vitest";
import { runBulkPrescore } from "@/scripts/bulk-prescore";

describe("runBulkPrescore", () => {
  it("fetches card names and passes them to scoreCards", async () => {
    const scoreCards = vi.fn().mockResolvedValue({ scored: 3, errors: [] });
    const result = await runBulkPrescore({
      fetchCardNames: vi.fn().mockResolvedValue(["Black Lotus", "Mox Pearl", "Sol Ring"]),
      scoreCards,
    });
    expect(scoreCards).toHaveBeenCalledWith(["Black Lotus", "Mox Pearl", "Sol Ring"]);
    expect(result.total).toBe(3);
    expect(result.scored).toBe(3);
    expect(result.errors).toHaveLength(0);
  });

  it("returns total=0 and skips scoreCards when no cards found", async () => {
    const scoreCards = vi.fn();
    const result = await runBulkPrescore({
      fetchCardNames: vi.fn().mockResolvedValue([]),
      scoreCards,
    });
    expect(scoreCards).not.toHaveBeenCalled();
    expect(result.total).toBe(0);
    expect(result.scored).toBe(0);
  });

  it("surfaces errors from scoreCards", async () => {
    const result = await runBulkPrescore({
      fetchCardNames: vi.fn().mockResolvedValue(["Bad Card"]),
      scoreCards: vi.fn().mockResolvedValue({
        scored: 0,
        errors: ["Bad Card: Scryfall 404"],
      }),
    });
    expect(result.errors).toContain("Bad Card: Scryfall 404");
    expect(result.scored).toBe(0);
  });

  it("returns error when fetchCardNames throws", async () => {
    const result = await runBulkPrescore({
      fetchCardNames: vi.fn().mockRejectedValue(new Error("DB unavailable")),
      scoreCards: vi.fn(),
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/DB unavailable/);
    expect(result.total).toBe(0);
  });
});
