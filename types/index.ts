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
  foil?: boolean;
  nonfoil?: boolean;
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

export type SignalType =
  | "buy_hype"
  | "format_staple"
  | "reprint_announced"
  | "price_peak"
  | "ban_risk"
  | "set_release_pressure"
  | "general";

export interface IntelSignal {
  id: string;
  card_name_raw: string;
  source_type: "youtube" | "reddit" | "news" | "mtggoldfish";
  source_url: string;
  source_title: string;
  sentiment: "bullish" | "bearish" | "neutral";
  signal_type?: SignalType;
  sell_window?: string | null;
  signal_strength: number;
  summary: string;
  published_at: string;
  ban_risk?: number;
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

// ── Watchlist ────────────────────────────────────────────────────────────────

export type WatchlistFinish = "nonfoil" | "foil" | "etched";
export type WatchlistStatus = "watching" | "owned";

export interface WatchlistEntry {
  id: string;              // Scryfall card id — unique per printing+finish combo
  card_name: string;
  set_code: string;
  set_name: string;
  collector_number: string;
  finish: WatchlistFinish;
  image_uri: string;
  type_line?: string;
  status: WatchlistStatus;
  added_at: string;        // ISO 8601
}

// ── Projections ──────────────────────────────────────────────────────────────

export type ProjectionVerdict = "BUY" | "HOLD" | "SELL";
export type SignalPip = "sentiment" | "signal" | "price" | "mechanics" | "generic";
export type ConditionOperator = "gt" | "gte" | "lt" | "lte" | "eq" | "neq";

export interface AlgorithmCondition {
  field: string;
  op: ConditionOperator;
  val: number | string;
}

export interface ProjectionAlgorithmDef {
  purpose_key: string;
  purpose_description: string;
  conditions: AlgorithmCondition[];
  verdict: ProjectionVerdict;
  confidence: number;
}

export interface ProjectionAlgorithm {
  id: string;
  purpose_key: string;
  purpose_description: string;
  algorithm_json: ProjectionAlgorithmDef;
  success_rate: number;
  validation_count: number;
  promoted: boolean;
  created_at: string;
  last_validated_at: string | null;
}

export interface Projection {
  id: string;
  card_name: string;
  verdict: ProjectionVerdict;
  confidence: number;
  reasoning: string;
  flavor_text: string | null;
  key_signals: string[];
  signal_pips: SignalPip[];
  algorithm_json: ProjectionAlgorithmDef | null;
  source: "claude" | "algorithm";
  purpose_key: string | null;
  cached_at: string;
  expires_at: string;
  outcome_price_validated: boolean;
  outcome_signal_validated: boolean;
  outcome_user_validated: boolean;
  outcome_score: number | null;
  validated_at: string | null;
}

// CardFeatures — flat map used by the algorithm runner
export interface CardFeatures {
  break_score: number;
  ban_risk: number;
  sentiment: "bullish" | "bearish" | "neutral";
  signal_count: number;
  price_trend_7d: "rising" | "falling" | "flat";
}
