import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichWithBanRisk } from "@/app/api/intel/enrich";

const makeSignal = (card_name_raw: string) => ({
  id: "1",
  card_name_raw,
  source_type: "reddit" as const,
  source_url: "",
  source_title: "",
  sentiment: "bullish" as const,
  signal_strength: 7,
  summary: "",
  published_at: "2026-06-11T00:00:00Z",
});

const makeClient = (mechanics: { card_name: string; ban_risk: number }[]) => ({
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: mechanics, error: null }),
    }),
  }),
});

describe("enrichWithBanRisk", () => {
  it("attaches ban_risk to signals whose card_name matches card_mechanics", async () => {
    const client = makeClient([{ card_name: "Ragavan, Nimble Pilferer", ban_risk: 0.82 }]);
    const signals = [makeSignal("Ragavan, Nimble Pilferer"), makeSignal("Llanowar Elves")];

    const result = await enrichWithBanRisk(signals, client as never);

    expect(result[0].ban_risk).toBe(0.82);
    expect(result[1].ban_risk).toBeUndefined();
  });

  it("returns signals unchanged when card_mechanics is empty", async () => {
    const client = makeClient([]);
    const signals = [makeSignal("Ragavan, Nimble Pilferer")];

    const result = await enrichWithBanRisk(signals, client as never);

    expect(result[0].ban_risk).toBeUndefined();
  });

  it("returns empty array unchanged", async () => {
    const client = makeClient([]);
    const result = await enrichWithBanRisk([], client as never);
    expect(result).toEqual([]);
  });
});
