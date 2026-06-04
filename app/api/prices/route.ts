import { NextRequest, NextResponse } from "next/server";
import { getPriceWithFallback } from "@/lib/price-sources";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    const data = await getPriceWithFallback(name);
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=1800" } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
