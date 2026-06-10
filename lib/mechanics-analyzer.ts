import Anthropic from "@anthropic-ai/sdk";
import type { ScryfallCard, MechanicsProfile, FormatKey } from "@/types";

// ── Enrichment types ─────────────────────────────────────────────────────────

export interface OracleEnrichment {
  comboCount: number;
  edhrecRank: number | null;
  formatStapleTier: string | null;
}

interface ClaudeScoreResult {
  break_score: number;
  ban_risk: number;
  ban_risk_by_format: Partial<Record<FormatKey, number>>;
  format_scores: Record<FormatKey, number>;
  ban_reasoning: string;
}

export interface MechanicsAnalyzerDeps {
  getOracleEnrichment?: (card: ScryfallCard) => Promise<OracleEnrichment>;
  claude?: (
    card: ScryfallCard,
    tier1Result: Omit<MechanicsProfile, "computed_at">
  ) => Promise<ClaudeScoreResult>;
}

// ── Mechanic weight table ────────────────────────────────────────────────────

type FormatOrAll = FormatKey | "all";

interface MechanicWeight {
  breakDelta: number;
  banRiskDelta: Partial<Record<FormatOrAll, number>>;
  formatScoreBoost: Partial<Record<FormatOrAll, number>>;
}

const MECHANIC_WEIGHTS: Record<string, MechanicWeight> = {
  extra_turn:     { breakDelta: 3,   banRiskDelta: { modern: 0.4, legacy: 0.3 },              formatScoreBoost: { modern: 2, legacy: 2 } },
  cascade:        { breakDelta: 2,   banRiskDelta: { modern: 0.3 },                            formatScoreBoost: { modern: 2, legacy: 1 } },
  companion:      { breakDelta: 3,   banRiskDelta: { all: 0.5 },                               formatScoreBoost: { all: 1 } },
  copy_permanent: { breakDelta: 2,   banRiskDelta: { modern: 0.35 },                           formatScoreBoost: { modern: 2, legacy: 1 } },
  free_spell:     { breakDelta: 2,   banRiskDelta: { legacy: 0.2, modern: 0.2 },               formatScoreBoost: { legacy: 2, modern: 1.5 } },
  ramp_land:      { breakDelta: 2,   banRiskDelta: { standard: 0.3, pioneer: 0.2 },            formatScoreBoost: { standard: 2, pioneer: 1.5, commander: 1 } },
  treasure_gen:   { breakDelta: 1,   banRiskDelta: { commander: 0.1 },                         formatScoreBoost: { commander: 1.5 } },
  cantrip:        { breakDelta: 1,   banRiskDelta: { modern: 0.15 },                           formatScoreBoost: { modern: 1, legacy: 1 } },
  reanimation:    { breakDelta: 1.5, banRiskDelta: { legacy: 0.2 },                            formatScoreBoost: { legacy: 2, commander: 1 } },
  tutor:          { breakDelta: 1.5, banRiskDelta: { legacy: 0.25, commander: 0.15 },          formatScoreBoost: { legacy: 2, commander: 1.5 } },
  escape:         { breakDelta: 2,   banRiskDelta: { modern: 0.3 },                            formatScoreBoost: { modern: 1.5, pioneer: 1 } },
  delve:          { breakDelta: 2,   banRiskDelta: { modern: 0.3 },                            formatScoreBoost: { modern: 1.5, legacy: 1 } },
  haste:          { breakDelta: 0.5, banRiskDelta: {},                                         formatScoreBoost: {} },
  flash:          { breakDelta: 1,   banRiskDelta: { modern: 0.1 },                            formatScoreBoost: { modern: 0.5, legacy: 0.5 } },
  lock_effect:    { breakDelta: 2.5, banRiskDelta: { all: 0.2 },                               formatScoreBoost: { legacy: 1, commander: 1 } },
};

// ── Mechanic detection patterns ──────────────────────────────────────────────

const MECHANIC_PATTERNS: Array<{
  key: string;
  match: (keywords: string[], oracle: string) => boolean;
}> = [
  { key: "extra_turn",     match: (_,  t) => /extra turn/i.test(t) },
  { key: "cascade",        match: (kw, t) => kw.includes("Cascade") || /\bcascade\b/i.test(t) },
  { key: "companion",      match: (kw, t) => kw.includes("Companion") || /^companion\s*—/im.test(t) },
  { key: "copy_permanent", match: (_,  t) => /create a (token that'?s a )?copy/i.test(t) || /copy (target|each|all)/i.test(t) },
  { key: "free_spell",     match: (_,  t) => /without paying its mana cost/i.test(t) },
  { key: "ramp_land", match: (_, t) => /search your library for .{0,30}land card/i.test(t) },
  { key: "treasure_gen",   match: (_,  t) => /create (a|an|one|two|three|\w+) treasure token/i.test(t) },
  { key: "cantrip",        match: (_,  t) => /draw a card/i.test(t) },
  { key: "reanimation",    match: (_,  t) => /return (target )?(creature|permanent|card) (card )?from (a |your |any |their )?graveyard.{0,30}(to the battlefield|to your hand)/i.test(t) },
  { key: "tutor",          match: (_,  t) => /search (your|a player'?s|their|a) library.{0,40}card/i.test(t) },
  { key: "escape",         match: (kw, t) => kw.includes("Escape") || /^escape\s*—/im.test(t) },
  { key: "delve",          match: (kw, _) => kw.includes("Delve") },
  { key: "haste",          match: (kw, _) => kw.includes("Haste") },
  { key: "flash",          match: (kw, _) => kw.includes("Flash") },
  { key: "lock_effect",    match: (_,  t) => /(players? can't|opponents? can't) (cast|play|draw|untap)/i.test(t) },
];

const FORMATS: FormatKey[] = ["standard", "pioneer", "modern", "legacy", "commander"];

// ── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, max: number, min = 0): number {
  return Math.min(max, Math.max(min, v));
}

function applyFormatDelta(
  delta: Partial<Record<FormatOrAll, number>>,
  target: Partial<Record<FormatKey, number>>
): void {
  for (const f of FORMATS) {
    const v = (delta.all ?? 0) + (delta[f] ?? 0);
    if (v !== 0) target[f] = (target[f] ?? 0) + v;
  }
}

function isLegal(card: ScryfallCard, f: FormatKey): boolean {
  return card.legalities?.[f] === "legal";
}

// ── Default Tier 2: Commander Spellbook + card.edhrec_rank ───────────────────

async function defaultGetOracleEnrichment(card: ScryfallCard): Promise<OracleEnrichment> {
  const edhrecRank = card.edhrec_rank ?? null;
  try {
    const url = `https://backend.commanderspellbook.com/variants/?q=card%3A%22${encodeURIComponent(card.name)}%22&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { comboCount: 0, edhrecRank, formatStapleTier: null };
    const data = (await res.json()) as { count?: number };
    return { comboCount: data.count ?? 0, edhrecRank, formatStapleTier: null };
  } catch {
    return { comboCount: 0, edhrecRank, formatStapleTier: null };
  }
}

// ── Default Tier 3: Claude synthesis ─────────────────────────────────────────

async function defaultClaude(
  card: ScryfallCard,
  partial: Omit<MechanicsProfile, "computed_at">
): Promise<ClaudeScoreResult> {
  const client = new Anthropic();
  const legalFormats = FORMATS.filter((f) => isLegal(card, f)).join(", ");
  const prompt = `You are an MTG competitive analyst. Given this card and preliminary rule-based scores, return refined scores as JSON only.

Card: ${card.name}
Oracle text: ${card.oracle_text ?? "(none)"}
Formats legal: ${legalFormats || "none"}
Preliminary break_score: ${partial.break_score}
Preliminary ban_risk: ${partial.ban_risk}
Preliminary format_scores: ${JSON.stringify(partial.format_scores)}
Detected mechanics: ${partial.mechanics.join(", ") || "none"}

Return this exact JSON:
{"break_score":<0-10>,"ban_risk":<0-1>,"ban_risk_by_format":{"standard":<0-1>,"pioneer":<0-1>,"modern":<0-1>,"legacy":<0-1>,"commander":<0-1>},"format_scores":{"standard":<0-10>,"pioneer":<0-10>,"modern":<0-10>,"legacy":<0-10>,"commander":<0-10>},"ban_reasoning":"<one sentence>"}`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });
  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(stripped) as ClaudeScoreResult;
  if (
    typeof parsed.break_score !== "number" ||
    typeof parsed.ban_risk !== "number" ||
    typeof parsed.format_scores !== "object" ||
    typeof parsed.ban_risk_by_format !== "object"
  ) {
    throw new Error("Claude returned invalid response shape");
  }
  return parsed;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export async function analyzeMechanics(
  card: ScryfallCard,
  deps: MechanicsAnalyzerDeps = {}
): Promise<MechanicsProfile> {
  const getEnrichment = deps.getOracleEnrichment ?? defaultGetOracleEnrichment;
  const claudeFn = deps.claude ?? defaultClaude;

  // ── Tier 1: Rule-based ────────────────────────────────────────────────────
  const kw = card.keywords ?? [];
  const oracle = card.oracle_text ?? "";
  const mechanics = MECHANIC_PATTERNS.filter((p) => p.match(kw, oracle)).map((p) => p.key);

  let breakScore = 1;
  const banRiskByFormat: Partial<Record<FormatKey, number>> = {};
  const formatScores: Record<FormatKey, number> = {
    standard: 1, pioneer: 1, modern: 1, legacy: 1, commander: 1,
  };

  for (const f of FORMATS) {
    if (!isLegal(card, f)) formatScores[f] = 0;
  }

  for (const key of mechanics) {
    const w = MECHANIC_WEIGHTS[key];
    if (!w) continue;
    breakScore += w.breakDelta;
    applyFormatDelta(w.banRiskDelta, banRiskByFormat);
    applyFormatDelta(w.formatScoreBoost, formatScores);
  }

  breakScore = clamp(breakScore, 10);
  for (const f of FORMATS) {
    banRiskByFormat[f] = clamp(banRiskByFormat[f] ?? 0, 1);
    formatScores[f] = clamp(isLegal(card, f) ? formatScores[f] : 0, 10);
    if (!isLegal(card, f)) banRiskByFormat[f] = 0;
  }

  let banRisk = clamp(Math.max(...FORMATS.map((f) => banRiskByFormat[f] ?? 0)), 1);
  let tierUsed: MechanicsProfile["tier_used"] = "rule_based";

  // ── Tier 2: Oracle enrichment ─────────────────────────────────────────────
  try {
    const enrichment = await getEnrichment(card);
    breakScore = clamp(breakScore + Math.min(enrichment.comboCount * 0.5, 2), 10);
    if (enrichment.edhrecRank !== null && enrichment.edhrecRank <= 500) {
      formatScores.commander = clamp(formatScores.commander + 2, 10);
    }
    banRisk = clamp(Math.max(...FORMATS.map((f) => banRiskByFormat[f] ?? 0)), 1);
    tierUsed = "mtgoracle";
  } catch {
    /* keep tier 1 scores */
  }

  // ── Tier 3: Claude synthesis ──────────────────────────────────────────────
  if (breakScore >= 7) {
    const partial: Omit<MechanicsProfile, "computed_at"> = {
      card_id: card.id,
      card_name: card.name,
      mechanics,
      format_scores: { ...formatScores },
      break_score: breakScore,
      ban_risk: banRisk,
      ban_risk_by_format: { ...banRiskByFormat },
      price_ceiling_flag: banRisk > 0.5,
      tier_used: tierUsed,
    };
    try {
      const r = await claudeFn(card, partial);
      breakScore = clamp(r.break_score, 10);
      const claudeBanRisk = clamp(r.ban_risk, 1);
      for (const f of FORMATS) {
        banRiskByFormat[f] = clamp(r.ban_risk_by_format[f] ?? banRiskByFormat[f] ?? 0, 1);
        formatScores[f] = isLegal(card, f) ? clamp(r.format_scores[f] ?? formatScores[f], 10) : 0;
      }
      return {
        card_id: card.id,
        card_name: card.name,
        mechanics,
        format_scores: { ...formatScores },
        break_score: breakScore,
        ban_risk: claudeBanRisk,
        ban_risk_by_format: { ...banRiskByFormat },
        price_ceiling_flag: claudeBanRisk > 0.5,
        ban_reasoning: r.ban_reasoning,
        tier_used: "claude",
        computed_at: new Date().toISOString(),
      };
    } catch {
      /* keep tier 2 scores */
    }
  }

  return {
    card_id: card.id,
    card_name: card.name,
    mechanics,
    format_scores: { ...formatScores },
    break_score: breakScore,
    ban_risk: banRisk,
    ban_risk_by_format: { ...banRiskByFormat },
    price_ceiling_flag: banRisk > 0.5,
    tier_used: tierUsed,
    computed_at: new Date().toISOString(),
  };
}
