import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { IntelSignal } from "@/types";

export interface SignalQuery {
  cardName?: string;
  limit?: number;
  after?: string;
}

type Client = Pick<SupabaseClient, "from">;

function getDefaultClient(): Client {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function storeSignals(
  signals: IntelSignal[],
  client: Client = getDefaultClient()
): Promise<void> {
  if (signals.length === 0) return;
  const { error } = await client.from("intel_signals").insert(signals);
  if (error) throw new Error(error.message);
}

export async function fetchSignals(
  query: SignalQuery,
  client: Client = getDefaultClient()
): Promise<IntelSignal[]> {
  const maxResults = query.limit ?? 50;
  const base = client
    .from("intel_signals")
    .select()
    .order("ingested_at", { ascending: false });

  const filtered = query.after ? base.gte("published_at", query.after) : base;
  const { data, error } = query.cardName
    ? await filtered.eq("card_name_raw", query.cardName).limit(maxResults)
    : await filtered.limit(maxResults);

  if (error) throw new Error(error.message);
  return (data ?? []) as IntelSignal[];
}
