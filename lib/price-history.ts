import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { PricePoint } from "@/types";

type Client = Pick<SupabaseClient, "from">;

function getDefaultClient(): Client {
  // Server-only: price_snapshots has RLS with no anon policies.
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function todayStartISO(): string {
  return `${new Date().toISOString().split("T")[0]}T00:00:00+00:00`;
}

/** Store at most one snapshot per card per UTC day. */
export async function recordSnapshot(
  cardName: string,
  priceUsd: number,
  priceUsdFoil: number | null,
  client: Client = getDefaultClient()
): Promise<void> {
  const { data } = await client
    .from("price_snapshots")
    .select("id")
    .eq("card_name", cardName)
    .gte("recorded_at", todayStartISO())
    .limit(1);

  if (data && data.length > 0) return;

  await client.from("price_snapshots").insert({
    card_name: cardName,
    price_usd: priceUsd,
    price_usd_foil: priceUsdFoil,
    source: "scryfall",
  });
}

/** Price history accrued from daily snapshots, oldest first. */
export async function getPriceHistory(
  cardName: string,
  days = 180,
  client: Client = getDefaultClient()
): Promise<PricePoint[]> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const { data, error } = await client
    .from("price_snapshots")
    .select("price_usd, recorded_at")
    .eq("card_name", cardName)
    .gte("recorded_at", since)
    .not("price_usd", "is", null)
    .order("recorded_at", { ascending: true });

  if (error || !data) return [];

  return data.map((row: { price_usd: string | number; recorded_at: string }) => ({
    date: row.recorded_at.split("T")[0],
    price: Number(row.price_usd),
    source: "snapshot",
  }));
}
