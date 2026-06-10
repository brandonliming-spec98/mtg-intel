import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all deps before importing the route
vi.mock("@/lib/mechanics-profiles", () => ({
  getMechanicsProfile: vi.fn(),
  upsertMechanicsProfile: vi.fn(),
  isStale: vi.fn(),
}));
vi.mock("@/lib/scryfall", () => ({
  getCardById: vi.fn(),
}));
vi.mock("@/lib/mechanics-analyzer", () => ({
  analyzeMechanics: vi.fn(),
}));

import { GET } from "@/app/api/mechanics/[cardId]/route";
import { getMechanicsProfile, upsertMechanicsProfile, isStale } from "@/lib/mechanics-profiles";
import { getCardById } from "@/lib/scryfall";
import { analyzeMechanics } from "@/lib/mechanics-analyzer";
import type { MechanicsProfile, ScryfallCard } from "@/types";

const makeProfile = (): MechanicsProfile => ({
  card_id: "card-abc",
  card_name: "Test Card",
  mechanics: ["haste"],
  format_scores: { standard: 3, pioneer: 3, modern: 3, legacy: 3, commander: 3 },
  break_score: 2,
  ban_risk: 0.1,
  ban_risk_by_format: {},
  price_ceiling_flag: false,
  tier_used: "rule_based",
  computed_at: new Date().toISOString(),
});

const makeCard = (): ScryfallCard => ({
  id: "card-abc",
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
  legalities: {},
  prices: {},
  released_at: "2024-01-01",
  reserved: false,
  reprint: false,
  uri: "",
  scryfall_uri: "",
});

function makeReq(): Request {
  return new Request("http://localhost/api/mechanics/card-abc");
}

function makeCtx(cardId = "card-abc") {
  return { params: Promise.resolve({ cardId }) };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(upsertMechanicsProfile).mockResolvedValue(undefined);
});

describe("GET /api/mechanics/[cardId]", () => {
  it("returns cached profile when fresh", async () => {
    const profile = makeProfile();
    vi.mocked(getMechanicsProfile).mockResolvedValue(profile);
    vi.mocked(isStale).mockReturnValue(false);

    const res = await GET(makeReq() as never, makeCtx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.card_id).toBe("card-abc");
    expect(getCardById).not.toHaveBeenCalled();
  });

  it("scores and returns fresh profile on cache miss", async () => {
    const profile = makeProfile();
    vi.mocked(getMechanicsProfile).mockResolvedValue(null);
    vi.mocked(getCardById).mockResolvedValue(makeCard());
    vi.mocked(analyzeMechanics).mockResolvedValue(profile);

    const res = await GET(makeReq() as never, makeCtx());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(getCardById).toHaveBeenCalledWith("card-abc");
    expect(analyzeMechanics).toHaveBeenCalledOnce();
    expect(body.card_id).toBe("card-abc");
  });

  it("re-scores when cached profile is stale", async () => {
    const staleProfile = makeProfile();
    const freshProfile = { ...makeProfile(), break_score: 5 };
    vi.mocked(getMechanicsProfile).mockResolvedValue(staleProfile);
    vi.mocked(isStale).mockReturnValue(true);
    vi.mocked(getCardById).mockResolvedValue(makeCard());
    vi.mocked(analyzeMechanics).mockResolvedValue(freshProfile);

    const res = await GET(makeReq() as never, makeCtx());
    expect(res.status).toBe(200);
    expect(analyzeMechanics).toHaveBeenCalledOnce();
  });

  it("returns 404 when Scryfall card not found", async () => {
    vi.mocked(getMechanicsProfile).mockResolvedValue(null);
    vi.mocked(getCardById).mockRejectedValue(new Error("Scryfall /cards/bad-id: 404"));

    const res = await GET(makeReq() as never, makeCtx("bad-id"));
    expect(res.status).toBe(404);
  });

  it("returns 500 for unexpected errors", async () => {
    vi.mocked(getMechanicsProfile).mockResolvedValue(null);
    vi.mocked(getCardById).mockRejectedValue(new Error("Database connection refused"));

    const res = await GET(makeReq() as never, makeCtx());
    expect(res.status).toBe(500);
  });
});
