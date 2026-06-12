import Anthropic from "@anthropic-ai/sdk";
import type {
  CardFeatures,
  ProjectionAlgorithmDef,
  ProjectionVerdict,
  SignalPip,
  IntelSignal,
  PricePoint,
} from "@/types";

type AnthropicClient = Pick<Anthropic, "messages">;

export interface ProjectionClaudeOutput {
  verdict: ProjectionVerdict;
  confidence: number;
  reasoning: string;
  flavor_text: string;
  key_signals: string[];
  signal_pips: SignalPip[];
  algorithm: ProjectionAlgorithmDef;
}

const SYSTEM_PROMPT = `You are an expert MTG finance analyst. Given card data, return a JSON projection with these exact fields:
- verdict: "BUY" | "HOLD" | "SELL"
- confidence: number 0.0–1.0
- reasoning: 2-3 sentence plain-English analysis (do not use markdown)
- flavor_text: one evocative short sentence (outcome timing or key risk)
- key_signals: array of 2-4 short label strings (e.g. ["Break Score 8.2", "Bullish Sentiment"])
- signal_pips: array of active signal categories from: "sentiment" | "signal" | "price" | "mechanics" | "generic"
- algorithm: a JSON rule that can replicate your verdict deterministically:
  {
    "purpose_key": "kebab-case-slug",
    "purpose_description": "one-line human-readable description",
    "conditions": [{ "field": "...", "op": "gt|gte|lt|lte|eq|neq", "val": ... }],
    "verdict": same as above,
    "confidence": same as above
  }
  Valid condition fields: break_score (number), ban_risk (number), sentiment ("bullish"|"bearish"|"neutral"), signal_count (number), price_trend_7d ("rising"|"falling"|"flat")

Return ONLY the JSON object, no markdown fences, no explanation.`;

export function parseProjectionResponse(text: string): ProjectionClaudeOutput | null {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !["BUY", "HOLD", "SELL"].includes(parsed.verdict) ||
      typeof parsed.confidence !== "number" ||
      typeof parsed.reasoning !== "string" ||
      !parsed.algorithm?.purpose_key
    ) {
      return null;
    }
    return parsed as ProjectionClaudeOutput;
  } catch {
    return null;
  }
}

export function buildProjectionInput(
  cardName: string,
  features: CardFeatures,
  recentSignals: Pick<IntelSignal, "signal_type" | "sentiment" | "signal_strength" | "published_at">[],
  priceHistory: PricePoint[]
): string {
  return JSON.stringify(
    {
      card_name: cardName,
      break_score: features.break_score,
      ban_risk: features.ban_risk,
      sentiment: features.sentiment,
      signal_count: features.signal_count,
      price_trend_7d: features.price_trend_7d,
      recent_signals: recentSignals.slice(0, 20),
      price_history: priceHistory.slice(-90),
    },
    null,
    2
  );
}

export async function callProjectionClaude(
  cardName: string,
  features: CardFeatures,
  recentSignals: Pick<IntelSignal, "signal_type" | "sentiment" | "signal_strength" | "published_at">[],
  priceHistory: PricePoint[],
  client?: AnthropicClient
): Promise<ProjectionClaudeOutput | null> {
  const resolvedClient = client ?? new Anthropic();
  const userMessage = buildProjectionInput(cardName, features, recentSignals, priceHistory);

  try {
    const response = await resolvedClient.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    const text = response.content.find((b) => b.type === "text")?.text ?? "";
    return parseProjectionResponse(text);
  } catch {
    return null;
  }
}
