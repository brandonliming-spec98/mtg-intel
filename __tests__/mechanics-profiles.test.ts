import { describe, it, expect, vi } from "vitest";
import {
  getMechanicsProfile,
  upsertMechanicsProfile,
  isStale,
  scoreNewCards,
} from "@/lib/mechanics-profiles";
import type { MechanicsProfile, ScryfallCard } from "@/types";

const makeProfile = (overrides: Partial<MechanicsProfile> = {}): MechanicsProfile => ({
  card_id: "card-123",
  card_name: "Test Card",
  mechanics: ["haste"],
  format_scores: { standard: 3, pioneer: 3, modern: 3, legacy: 3, commander: 3 },
  break_score: 2,
  ban_risk: 0.1,
  ban_risk_by_format: {},
  price_ceiling_flag: false,
  tier_used: "rule_based",
  computed_at: new Date().toISOString(),
  ...overrides,
});

const makeCard = (overrides: Partial<ScryfallCard> = {}): ScryfallCard => ({
  id: "card-123",
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
  legalities: { standard: "legal", pioneer: "legal", modern: "legal", legacy: "legal", commander: "legal" },
  prices: {},
  released_at: "2024-01-01",
  reserved: false,
  reprint: false,
  uri: "",
  scryfall_uri: "",
  ...overrides,
});

describe("getMechanicsProfile", () => {
  it("returns null when not found", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    const result = await getMechanicsProfile("card-123", client as never);
    expect(result).toBeNull();
  });

  it("returns profile when found", async () => {
    const profile = makeProfile();
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: profile, error: null }),
      }),
    };
    const result = await getMechanicsProfile("card-123", client as never);
    expect(result).toEqual(profile);
  });
});

describe("upsertMechanicsProfile", () => {
  it("calls upsert on card_mechanics with the profile", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ upsert }) };
    const profile = makeProfile();
    await upsertMechanicsProfile(profile, client as never);
    expect(client.from).toHaveBeenCalledWith("card_mechanics");
    expect(upsert).toHaveBeenCalledWith(profile, { onConflict: "card_id" });
  });

  it("throws when Supabase returns an error", async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: "constraint violation" } }),
      }),
    };
    await expect(
      upsertMechanicsProfile(makeProfile(), client as never)
    ).rejects.toThrow("constraint violation");
  });
});

describe("isStale", () => {
  it("returns false for a profile computed moments ago", () => {
    expect(isStale(makeProfile())).toBe(false);
  });

  it("returns true for a profile computed 8 days ago", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStale(makeProfile({ computed_at: eightDaysAgo }))).toBe(true);
  });
});

describe("scoreNewCards", () => {
  it("skips cards with fresh profiles", async () => {
    const profile = makeProfile();
    const scoreMechanics = vi.fn();
    await scoreNewCards(["Test Card"], {
      getCard: vi.fn().mockResolvedValue(makeCard()),
      getProfile: vi.fn().mockResolvedValue(profile),
      scoreMechanics,
      saveProfile: vi.fn(),
    });
    expect(scoreMechanics).not.toHaveBeenCalled();
  });

  it("scores and saves cards with missing profiles", async () => {
    const profile = makeProfile();
    const saveProfile = vi.fn().mockResolvedValue(undefined);
    const result = await scoreNewCards(["Test Card"], {
      getCard: vi.fn().mockResolvedValue(makeCard()),
      getProfile: vi.fn().mockResolvedValue(null),
      scoreMechanics: vi.fn().mockResolvedValue(profile),
      saveProfile,
    });
    expect(saveProfile).toHaveBeenCalledWith(profile);
    expect(result.scored).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("adds to errors when getCard throws", async () => {
    const result = await scoreNewCards(["Missing Card"], {
      getCard: vi.fn().mockRejectedValue(new Error("not found")),
      getProfile: vi.fn(),
      scoreMechanics: vi.fn(),
      saveProfile: vi.fn(),
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Missing Card");
  });

  it("deduplicates card names", async () => {
    const getCard = vi.fn().mockResolvedValue(makeCard());
    await scoreNewCards(["Test Card", "Test Card"], {
      getCard,
      getProfile: vi.fn().mockResolvedValue(null),
      scoreMechanics: vi.fn().mockResolvedValue(makeProfile()),
      saveProfile: vi.fn(),
    });
    expect(getCard).toHaveBeenCalledOnce();
  });

  it("re-scores cards with stale profiles", async () => {
    const staleProfile = makeProfile({
      computed_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const freshProfile = makeProfile({ break_score: 5 });
    const saveProfile = vi.fn().mockResolvedValue(undefined);
    const result = await scoreNewCards(["Test Card"], {
      getCard: vi.fn().mockResolvedValue(makeCard()),
      getProfile: vi.fn().mockResolvedValue(staleProfile),
      scoreMechanics: vi.fn().mockResolvedValue(freshProfile),
      saveProfile,
    });
    expect(saveProfile).toHaveBeenCalledWith(freshProfile);
    expect(result.scored).toBe(1);
  });
});
