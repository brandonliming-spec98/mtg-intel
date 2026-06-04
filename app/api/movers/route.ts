import { NextResponse } from "next/server";
import { getMTGStocksInterests } from "@/lib/mtgstocks";

export async function GET() {
  try {
    const data = await getMTGStocksInterests();
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=3600" } });
  } catch {
    return NextResponse.json({ average: [], foil: [] });
  }
}
