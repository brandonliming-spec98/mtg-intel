import { NextRequest, NextResponse } from "next/server";
import { autocomplete } from "@/lib/scryfall";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  try {
    const suggestions = await autocomplete(q);
    return NextResponse.json({ suggestions }, { headers: { "Cache-Control": "s-maxage=600" } });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
