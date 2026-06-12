import { NextResponse } from "next/server";
import { getMTGGoldfishMovers } from "@/lib/mtggoldfish";

export async function GET() {
  try {
    const data = await getMTGGoldfishMovers();
    return NextResponse.json(data, { headers: { "Cache-Control": "s-maxage=3600" } });
  } catch {
    return NextResponse.json({ average: [], foil: [] });
  }
}
