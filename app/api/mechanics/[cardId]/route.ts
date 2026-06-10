import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  getMechanicsProfile,
  upsertMechanicsProfile,
  isStale,
} from "@/lib/mechanics-profiles";
import { getCardById } from "@/lib/scryfall";
import { analyzeMechanics } from "@/lib/mechanics-analyzer";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const { cardId } = await params;

  try {
    const cached = await getMechanicsProfile(cardId);
    if (cached && !isStale(cached)) {
      return NextResponse.json(cached);
    }

    const card = await getCardById(cardId);
    const profile = await analyzeMechanics(card);
    upsertMechanicsProfile(profile).catch(() => { /* best-effort */ });
    return NextResponse.json(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
