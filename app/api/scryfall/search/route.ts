import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/scryfall";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1");
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 });
  try {
    const data = await searchCards(q, page);
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=300" } });
  } catch (err: any) {
    if (err.message?.includes("404")) return NextResponse.json({ data: [], total_cards: 0, has_more: false });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
