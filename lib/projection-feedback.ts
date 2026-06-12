import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProjectionAlgorithmDef } from "@/types";

type Client = Pick<SupabaseClient, "from">;

// Weights: price=0.5, signal=0.3, user=0.2
const WEIGHTS = { price: 0.5, signal: 0.3, user: 0.2 };

export function computeOutcomeScore(
  priceCorrect: boolean | null,
  signalCorrect: boolean | null,
  userCorrect: boolean | null
): number {
  const signals: Array<{ weight: number; value: boolean }> = [];
  if (priceCorrect !== null)  signals.push({ weight: WEIGHTS.price,  value: priceCorrect });
  if (signalCorrect !== null) signals.push({ weight: WEIGHTS.signal, value: signalCorrect });
  if (userCorrect !== null)   signals.push({ weight: WEIGHTS.user,   value: userCorrect });
  if (signals.length === 0) return 0;
  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const weightedSum = signals.reduce((s, x) => s + x.weight * (x.value ? 1 : 0), 0);
  return weightedSum / totalWeight;
}

export async function upsertAlgorithm(
  supabase: Client,
  algo: ProjectionAlgorithmDef
): Promise<void> {
  const { data: existing } = await supabase
    .from("projection_algorithms")
    .select("id, algorithm_json")
    .eq("purpose_key", algo.purpose_key)
    .maybeSingle();

  if (!existing) {
    await supabase.from("projection_algorithms").insert({
      purpose_key: algo.purpose_key,
      purpose_description: algo.purpose_description,
      algorithm_json: algo,
      success_rate: 0,
      validation_count: 0,
      promoted: false,
    });
    return;
  }

  const existingConf = (existing.algorithm_json as ProjectionAlgorithmDef).confidence;
  if (algo.confidence > existingConf) {
    await supabase
      .from("projection_algorithms")
      .update({
        algorithm_json: algo,
        purpose_description: algo.purpose_description,
        validation_count: 0,
        promoted: false,
        success_rate: 0,
      })
      .eq("purpose_key", algo.purpose_key);
  }
}

export async function updateAlgorithmSuccessRate(
  supabase: Client,
  purposeKey: string,
  outcomeScore: number
): Promise<void> {
  const { data: existing } = await supabase
    .from("projection_algorithms")
    .select("id, success_rate, validation_count")
    .eq("purpose_key", purposeKey)
    .maybeSingle();

  if (!existing) return;

  const oldCount: number = existing.validation_count;
  const oldRate: number = existing.success_rate;
  const newCount = oldCount + 1;
  const newRate = (oldRate * oldCount + outcomeScore) / newCount;
  const promoted = newCount >= 5 && newRate >= 0.75;

  await supabase
    .from("projection_algorithms")
    .update({
      success_rate: newRate,
      validation_count: newCount,
      promoted,
      last_validated_at: new Date().toISOString(),
    })
    .eq("purpose_key", purposeKey);
}

export async function runPriceFeedback(
  supabase: Client,
  fetchPrice: (name: string) => Promise<{ currentPrice: number | null } | null>
): Promise<void> {
  const cutoff = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("card_projections")
    .select("id, card_name, verdict, confidence, purpose_key, cached_at")
    .lt("cached_at", cutoff)
    .eq("outcome_price_validated", false)
    .limit(50);

  for (const row of rows ?? []) {
    const priceData = await fetchPrice(row.card_name);
    if (!priceData?.currentPrice) continue;

    // Without historical price at cached_at, we use current as the baseline
    // In production this would compare against historical data
    const deltaPct = 0; // placeholder — real impl compares cached vs current

    const priceCorrect =
      (row.verdict === "BUY"  && deltaPct >= 5)  ||
      (row.verdict === "SELL" && deltaPct <= -5) ||
      (row.verdict === "HOLD" && Math.abs(deltaPct) < 5);

    await supabase
      .from("card_projections")
      .update({ outcome_price_validated: true })
      .eq("id", row.id);

    await maybeFinalize(supabase, row.id, row.purpose_key, priceCorrect);
  }
}

export async function runSignalFeedback(supabase: Client): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: rows } = await supabase
    .from("card_projections")
    .select("id, card_name, verdict, purpose_key, cached_at")
    .lt("cached_at", cutoff)
    .eq("outcome_signal_validated", false)
    .limit(50);

  for (const row of rows ?? []) {
    const { data: newSignals } = await supabase
      .from("intel_signals")
      .select("sentiment")
      .eq("card_name_raw", row.card_name)
      .gte("ingested_at", row.cached_at)
      .limit(20);

    const signals = newSignals ?? [];
    const bullishCount = signals.filter((s: { sentiment: string }) => s.sentiment === "bullish").length;
    const bearishCount = signals.filter((s: { sentiment: string }) => s.sentiment === "bearish").length;
    const signalCorrect =
      (row.verdict === "BUY"  && bullishCount >= 2) ||
      (row.verdict === "SELL" && bearishCount >= 2) ||
      (row.verdict === "HOLD" && signals.length < 2);

    await supabase
      .from("card_projections")
      .update({ outcome_signal_validated: true })
      .eq("id", row.id);

    await maybeFinalize(supabase, row.id, row.purpose_key, null, signalCorrect);
  }
}

async function maybeFinalize(
  supabase: Client,
  projectionId: string,
  purposeKey: string | null,
  priceCorrect?: boolean | null,
  signalCorrect?: boolean | null
): Promise<void> {
  const { data: row } = await supabase
    .from("card_projections")
    .select(
      "outcome_price_validated, outcome_signal_validated, outcome_user_validated, cached_at, verdict"
    )
    .eq("id", projectionId)
    .maybeSingle();

  if (!row) return;

  const daysOld =
    (Date.now() - new Date(row.cached_at).getTime()) / (24 * 60 * 60 * 1000);
  const allCollected =
    row.outcome_price_validated &&
    row.outcome_signal_validated &&
    row.outcome_user_validated;

  if (!allCollected && daysOld < 35) return;

  const pVal = priceCorrect ?? null;
  const sVal = signalCorrect ?? null;
  const uVal = row.outcome_user_validated ? true : null;
  const score = computeOutcomeScore(pVal, sVal, uVal);

  await supabase
    .from("card_projections")
    .update({ outcome_score: score, validated_at: new Date().toISOString() })
    .eq("id", projectionId);

  if (purposeKey) {
    await updateAlgorithmSuccessRate(supabase, purposeKey, score);
  }
}
