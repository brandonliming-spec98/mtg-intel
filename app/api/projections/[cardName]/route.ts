import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAlgorithms } from "@/lib/projection-engine";
import { callProjectionClaude } from "@/lib/projection-prompt";
import { upsertAlgorithm } from "@/lib/projection-feedback";
import { getPriceWithFallback } from "@/lib/price-sources";
import { fetchSignals } from "@/lib/supabase-signals";
import type { CardFeatures, ProjectionAlgorithm, Projection } from "@/types";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function computePriceTrend(history: { price: number }[]): "rising" | "falling" | "flat" {
  if (history.length < 14) return "flat";
  const recent = history.slice(-7).reduce((s, p) => s + p.price, 0) / 7;
  const prev = history.slice(-14, -7).reduce((s, p) => s + p.price, 0) / 7;
  if (prev === 0) return "flat";
  const delta = (recent - prev) / prev;
  if (delta > 0.03) return "rising";
  if (delta < -0.03) return "falling";
  return "flat";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardName: string }> }
) {
  const { cardName } = await params;
  const name = decodeURIComponent(cardName);

  const supabase = getClient();

  // 1. Cache check
  const { data: cached } = await supabase
    .from("card_projections")
    .select("*")
    .eq("card_name", name)
    .gt("expires_at", new Date().toISOString())
    .order("cached_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (cached) {
    return NextResponse.json(cached as Projection);
  }

  // 2. Load card data in parallel
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [priceData, signals, mechanicsRow] = await Promise.all([
    getPriceWithFallback(name).catch(() => null),
    fetchSignals({ cardName: name, limit: 30, after: thirtyDaysAgo }).catch(() => []),
    Promise.resolve(
      supabase
        .from("card_mechanics")
        .select("break_score, ban_risk")
        .eq("card_name", name)
        .maybeSingle()
        .then((r) => r.data as { break_score: number; ban_risk: number } | null)
    ).catch(() => null),
  ]);

  const history = priceData?.history ?? [];
  const bullish = signals.filter((s) => s.sentiment === "bullish").length;
  const bearish = signals.filter((s) => s.sentiment === "bearish").length;
  const sentiment: CardFeatures["sentiment"] =
    bullish > bearish ? "bullish" : bearish > 0 ? "bearish" : "neutral";

  const features: CardFeatures = {
    break_score: mechanicsRow?.break_score ?? 0,
    ban_risk: mechanicsRow?.ban_risk ?? 0,
    sentiment,
    signal_count: signals.length,
    price_trend_7d: computePriceTrend(history),
  };

  // 3. Try promoted algorithms
  const { data: algoRows } = await supabase
    .from("projection_algorithms")
    .select("*")
    .eq("promoted", true);

  const algorithms: ProjectionAlgorithm[] = (algoRows ?? []) as ProjectionAlgorithm[];
  const algoResult = runAlgorithms(algorithms, features);

  let projectionPayload: {
    verdict: Projection["verdict"];
    confidence: number;
    reasoning: string;
    flavor_text: string | null;
    key_signals: string[];
    signal_pips: Projection["signal_pips"];
    algorithm_json: Projection["algorithm_json"];
  };
  let source: "claude" | "algorithm" = "claude";
  let purpose_key: string | null = null;

  if (algoResult && algoResult.confidence >= 0.8) {
    projectionPayload = {
      verdict: algoResult.verdict,
      confidence: algoResult.confidence,
      reasoning: `Projection driven by the ${algoResult.purpose_key} pattern.`,
      flavor_text: null,
      key_signals: [features.sentiment, `Break Score ${features.break_score.toFixed(1)}`],
      signal_pips: ["mechanics", "sentiment"],
      algorithm_json: null,
    };
    source = "algorithm";
    purpose_key = algoResult.purpose_key;
  } else {
    // 4. Call Claude
    const claudeResult = await callProjectionClaude(name, features, signals, history);
    if (!claudeResult) {
      return NextResponse.json({ error: "Projection unavailable" }, { status: 503 });
    }
    projectionPayload = {
      verdict: claudeResult.verdict,
      confidence: claudeResult.confidence,
      reasoning: claudeResult.reasoning,
      flavor_text: claudeResult.flavor_text,
      key_signals: claudeResult.key_signals,
      signal_pips: claudeResult.signal_pips,
      algorithm_json: claudeResult.algorithm,
    };
    purpose_key = claudeResult.algorithm.purpose_key;
    // 5. Upsert algorithm (best-effort)
    upsertAlgorithm(supabase, claudeResult.algorithm).catch(() => {});
  }

  // 6. Store projection
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: inserted, error } = await supabase
    .from("card_projections")
    .insert({
      card_name: name,
      ...projectionPayload,
      source,
      purpose_key,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(inserted as Projection);
}
