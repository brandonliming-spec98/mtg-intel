import { NextRequest, NextResponse } from "next/server";
import { fetchSignals } from "@/lib/supabase-signals";
import { enrichWithBanRisk } from "./enrich";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const cardName = searchParams.get("card") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  try {
    const signals = await fetchSignals({ cardName, limit });
    const enriched = await enrichWithBanRisk(signals);
    return NextResponse.json(enriched, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
