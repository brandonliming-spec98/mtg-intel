import { describe, it, expect, vi } from "vitest";
import { analyzeMechanics } from "@/lib/mechanics-analyzer";
import type { ScryfallCard } from "@/types";

const noEnrichment = vi.fn().mockResolvedValue({
  comboCount: 0,
  edhrecRank: null,
  formatStapleTier: null,
});
const noClaude = vi.fn();

function makeCard(overrides: Partial<ScryfallCard> = {}): ScryfallCard {
  return {
    id: "test-id",
    name: "Test Card",
    set: "tst",
    set_name: "Test Set",
    collector_number: "1",
    rarity: "rare",
    cmc: 2,
    type_line: "Creature",
    oracle_text: "",
    colors: [],
    color_identity: [],
    keywords: [],
    legalities: {
      standard: "legal",
      pioneer: "legal",
      modern: "legal",
      legacy: "legal",
      commander: "legal",
    },
    prices: {},
    released_at: "2024-01-01",
    reserved: false,
    reprint: false,
    uri: "",
    scryfall_uri: "",
    ...overrides,
  };
}

// ── Tier 1 ───────────────────────────────────────────────────────────────────

describe("analyzeMechanics — Tier 1", () => {
  it("returns break_score >= 1 for a vanilla card", async () => {
    const profile = await analyzeMechanics(makeCard(), {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.break_score).toBeGreaterThanOrEqual(1);
    expect(profile.break_score).toBeLessThanOrEqual(10);
  });

  it("detects extra_turn in oracle text and boosts break_score by 3", async () => {
    const card = makeCard({ oracle_text: "Take an extra turn after this one." });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.break_score).toBeGreaterThanOrEqual(4);
    expect(profile.mechanics).toContain("extra_turn");
  });

  it("detects companion keyword and raises ban_risk across all formats", async () => {
    const card = makeCard({
      keywords: ["Companion"],
      oracle_text: "Companion — Your starting deck contains only cards with even mana values.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.ban_risk).toBeGreaterThan(0.4);
    expect(profile.mechanics).toContain("companion");
  });

  it("sets format_score to 0 for illegal formats", async () => {
    const card = makeCard({
      legalities: {
        standard: "not_legal",
        pioneer: "legal",
        modern: "legal",
        legacy: "legal",
        commander: "legal",
      },
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.format_scores.standard).toBe(0);
  });

  it("caps break_score at 10", async () => {
    const card = makeCard({
      keywords: ["Companion", "Cascade", "Escape"],
      oracle_text:
        "Companion — ... Take an extra turn. Create a copy of target permanent. Players can't cast spells.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.break_score).toBeLessThanOrEqual(10);
  });

  it("sets tier_used to rule_based when enrichment fails", async () => {
    const failingEnrichment = vi.fn().mockRejectedValue(new Error("subprocess failed"));
    const card = makeCard();
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: failingEnrichment,
      claude: noClaude,
    });
    expect(profile.tier_used).toBe("rule_based");
  });

  it("detects ramp_land in oracle text", async () => {
    const card = makeCard({
      oracle_text: "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.mechanics).toContain("ramp_land");
    expect(profile.break_score).toBeGreaterThan(1);
  });
});

// ── Tier 2 ───────────────────────────────────────────────────────────────────

describe("analyzeMechanics — Tier 2", () => {
  it("boosts break_score by 0.5 per combo, capped at +2", async () => {
    const enrichment = vi.fn().mockResolvedValue({
      comboCount: 10,
      edhrecRank: null,
      formatStapleTier: null,
    });
    const card = makeCard();
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: enrichment,
      claude: noClaude,
    });
    // base 1 + max combo boost 2 = 3
    expect(profile.break_score).toBeLessThanOrEqual(3);
    expect(profile.break_score).toBeGreaterThan(1);
  });

  it("boosts commander score for EDHREC rank <= 500", async () => {
    const enrichment = vi.fn().mockResolvedValue({
      comboCount: 0,
      edhrecRank: 200,
      formatStapleTier: null,
    });
    const card = makeCard();
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: enrichment,
      claude: noClaude,
    });
    expect(profile.format_scores.commander).toBeGreaterThan(1);
  });

  it("sets tier_used to mtgoracle after successful enrichment", async () => {
    const profile = await analyzeMechanics(makeCard(), {
      getOracleEnrichment: noEnrichment,
      claude: noClaude,
    });
    expect(profile.tier_used).toBe("mtgoracle");
  });
});

// ── Tier 3 ───────────────────────────────────────────────────────────────────

describe("analyzeMechanics — Tier 3", () => {
  it("does NOT call Claude when break_score < 7", async () => {
    const mockClaude = vi.fn();
    await analyzeMechanics(makeCard(), {
      getOracleEnrichment: noEnrichment,
      claude: mockClaude,
    });
    expect(mockClaude).not.toHaveBeenCalled();
  });

  it("calls Claude and updates scores when break_score >= 7", async () => {
    const mockClaude = vi.fn().mockResolvedValue({
      break_score: 9,
      ban_risk: 0.8,
      ban_risk_by_format: { modern: 0.9, legacy: 0.7, standard: 0, pioneer: 0, commander: 0.3 },
      format_scores: { standard: 0, pioneer: 0, modern: 10, legacy: 8, commander: 5 },
      ban_reasoning: "Enables consistent turn-3 kills.",
    });
    const card = makeCard({
      keywords: ["Companion"],
      oracle_text: "Companion — ... Take an extra turn after this one. Cascade.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: mockClaude,
    });
    expect(mockClaude).toHaveBeenCalledOnce();
    expect(profile.tier_used).toBe("claude");
    expect(profile.ban_reasoning).toBe("Enables consistent turn-3 kills.");
    expect(profile.format_scores.modern).toBe(10);
  });

  it("keeps tier 2 scores if Claude throws", async () => {
    const mockClaude = vi.fn().mockRejectedValue(new Error("API error"));
    const card = makeCard({
      keywords: ["Companion"],
      oracle_text: "Companion — ... Take an extra turn after this one. Cascade.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: mockClaude,
    });
    expect(profile.tier_used).toBe("mtgoracle");
  });

  it("sets price_ceiling_flag when ban_risk > 0.5", async () => {
    const mockClaude = vi.fn().mockResolvedValue({
      break_score: 9,
      ban_risk: 0.7,
      ban_risk_by_format: { modern: 0.9, legacy: 0, standard: 0, pioneer: 0, commander: 0 },
      format_scores: { standard: 0, pioneer: 0, modern: 10, legacy: 8, commander: 5 },
      ban_reasoning: "Format warping.",
    });
    const card = makeCard({
      keywords: ["Companion"],
      oracle_text: "Take an extra turn. Cascade. Create a copy.",
    });
    const profile = await analyzeMechanics(card, {
      getOracleEnrichment: noEnrichment,
      claude: mockClaude,
    });
    expect(profile.price_ceiling_flag).toBe(true);
  });
});
