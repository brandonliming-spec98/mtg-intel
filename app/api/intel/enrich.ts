import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { IntelSignal } from "@/types";

type Client = Pick<SupabaseClient, "from">;

function getDefaultClient(): Client {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function enrichWithBanRisk(
  signals: IntelSignal[],
  client: Client = getDefaultClient()
): Promise<IntelSignal[]> {
  if (signals.length === 0) return signals;

  const names = [...new Set(signals.map((s) => s.card_name_raw))];
  const { data } = await client
    .from("card_mechanics")
    .select("card_name, ban_risk")
    .in("card_name", names);

  const banRiskMap = new Map<string, number>(
    (data ?? []).map((m: { card_name: string; ban_risk: number }) => [m.card_name, m.ban_risk])
  );

  return signals.map((s) => {
    const br = banRiskMap.get(s.card_name_raw);
    return br !== undefined ? { ...s, ban_risk: br } : s;
  });
}
