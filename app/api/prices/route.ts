import { NextRequest, NextResponse } from "next/server";
import { getPriceWithFallback } from "@/lib/price-sources";
import { recordSnapshot, getPriceHistory } from "@/lib/price-history";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const data = await getPriceWithFallback(name);
    if (data?.currentPrice != null) {
      // History accrues from daily snapshots since MTGStocks (which provided
      // backfilled history) shut down their API.
      recordSnapshot(name, data.currentPrice, data.currentFoilPrice).catch(() => {});
      data.history = await getPriceHistory(name).catch(() => []);
    }
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=1800" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
