import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeOutcomeScore, updateAlgorithmSuccessRate } from "@/lib/projection-feedback";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const userCorrect = (body as Record<string, unknown>)?.user_correct;
  if (typeof userCorrect !== "boolean") {
    return NextResponse.json({ error: "user_correct must be boolean" }, { status: 400 });
  }

  const supabase = getClient();

  const { data: row, error } = await supabase
    .from("card_projections")
    .select("id, purpose_key, outcome_price_validated, outcome_signal_validated, outcome_user_validated, cached_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Projection not found" }, { status: 404 });
  }

  await supabase
    .from("card_projections")
    .update({ outcome_user_validated: userCorrect })
    .eq("id", id);

  // Attempt to finalize composite score when all signals are collected or 35 days old
  const daysOld = (Date.now() - new Date(row.cached_at).getTime()) / (24 * 60 * 60 * 1000);
  const allCollected =
    row.outcome_price_validated &&
    row.outcome_signal_validated;

  if ((allCollected || daysOld >= 35) && row.purpose_key) {
    const priceVal = row.outcome_price_validated ? true : null;
    const signalVal = row.outcome_signal_validated ? true : null;
    const score = computeOutcomeScore(priceVal, signalVal, userCorrect);

    await supabase
      .from("card_projections")
      .update({ outcome_score: score, validated_at: new Date().toISOString() })
      .eq("id", id);

    await updateAlgorithmSuccessRate(supabase, row.purpose_key, score);
  }

  return NextResponse.json({ ok: true });
}
