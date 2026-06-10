// ── Scryfall Types ──────────────────────────────────────────────────────────

export interface ScryfallCard {
  id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  keywords?: string[];
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity: string[];
  legalities: Record<string, string>;
  prices: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
  image_uris?: {
    small: string;
    normal: string;
    large: string;
    art_crop: string;
    border_crop: string;
  };
  card_faces?: Array<{
    name: string;
    oracle_text?: string;
    image_uris?: ScryfallCard["image_uris"];
  }>;
  released_at: string;
  edhrec_rank?: number;
  reserved: boolean;
  reprint: boolean;
  uri: string;
  scryfall_uri: string;
}

export interface ScryfallSearchResult {
  data: ScryfallCard[];
  total_cards: number;
  has_more: boolean;
  next_page?: string;
}

export interface ScryfallRuling {
  source: string;
  published_at: string;
  comment: string;
}

export interface ScryfallSet {
  id: string;
  code: string;
  name: string;
  set_type: string;
  released_at?: string;
  card_count: number;
  icon_svg_uri: string;
}

// ── Price Types ─────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string;
  price: number;
  source: string;
}

export interface CardPriceData {
  cardName: string;
  currentPrice: number | null;
  currentFoilPrice: number | null;
  history: PricePoint[];
  source: "mtgstocks" | "mtggoldfish" | "scryfall" | "tcgplayer";
  lastUpdated: string;
}

// Stub interface for future price sources (TCGPlayer, etc.)
export interface PriceSourceAdapter {
  name: string;
  enabled: boolean;
  fetchPrice(cardName: string, setCode?: string): Promise<CardPriceData | null>;
  fetchHistory(cardName: string, setCode?: string): Promise<PricePoint[]>;
}

// ── MTGStocks Types ─────────────────────────────────────────────────────────

export interface MTGStocksInterest {
  name: string;
  id: number;
  print_id: number;
  percent: number;
  avg: number;
  new_price: number;
  old_price: number;
  set_name?: string;
  rarity?: string;
}

export interface MTGStocksInterestsResponse {
  average: MTGStocksInterest[];
  foil: MTGStocksInterest[];
}

// ── App-level card display type ─────────────────────────────────────────────

export interface CardWithPrice extends ScryfallCard {
  priceData?: CardPriceData;
}

// ── Intel Signal (Phase 2 preview) ──────────────────────────────────────────

export interface IntelSignal {
  id: string;
  card_name_raw: string;
  source_type: "youtube" | "reddit" | "news" | "mtggoldfish";
  source_url: string;
  source_title: string;
  sentiment: "bullish" | "bearish" | "neutral";
  signal_strength: number;
  summary: string;
  published_at: string;
}

// ── Mechanics Profile (Phase 4) ─────────────────────────────────────────────

export type FormatKey = "standard" | "pioneer" | "modern" | "legacy" | "commander";

export interface MechanicsProfile {
  card_id: string;
  card_name: string;
  mechanics: string[];
  format_scores: Record<FormatKey, number>;
  break_score: number;
  ban_risk: number;
  ban_risk_by_format: Partial<Record<FormatKey, number>>;
  price_ceiling_flag: boolean;
  ban_reasoning?: string;
  tier_used: "rule_based" | "mtgoracle" | "claude";
  computed_at: string;
}
