import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { MechanicsProfile, ScryfallCard } from "@/types";
import { getCardByName } from "@/lib/scryfall";

type Client = Pick<SupabaseClient, "from">;

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

let _defaultClient: Client | null = null;
function getDefaultClient(): Client {
  return (_defaultClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  ));
}

export async function getMechanicsProfile(
  cardId: string,
  client: Client = getDefaultClient()
): Promise<MechanicsProfile | null> {
  const { data, error } = await client
    .from("card_mechanics")
    .select()
    .eq("card_id", cardId)
    .single();
  if (error || !data) return null;
  return data as MechanicsProfile;
}

export async function upsertMechanicsProfile(
  profile: MechanicsProfile,
  client: Client = getDefaultClient()
): Promise<void> {
  const { error } = await client
    .from("card_mechanics")
    .upsert(profile, { onConflict: "card_id" });
  if (error) throw new Error(error.message);
}

export function isStale(profile: MechanicsProfile): boolean {
  return Date.now() - new Date(profile.computed_at).getTime() > STALE_MS;
}

export async function fetchMechanicsProfile(
  cardId: string
): Promise<MechanicsProfile | null> {
  try {
    const base =
      typeof window !== "undefined"
        ? ""
        : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
    const res = await fetch(`${base}/api/mechanics/${cardId}`);
    if (!res.ok) return null;
    return (await res.json()) as MechanicsProfile;
  } catch {
    return null;
  }
}

export async function scoreNewCards(
  cardNames: string[],
  deps: {
    getCard?: (name: string) => Promise<ScryfallCard>;
    getProfile?: (id: string, client?: Client) => Promise<MechanicsProfile | null>;
    scoreMechanics?: (card: ScryfallCard) => Promise<MechanicsProfile>;
    saveProfile?: (profile: MechanicsProfile, client?: Client) => Promise<void>;
  } = {}
): Promise<{ scored: number; errors: string[] }> {
  const getCard = deps.getCard ?? getCardByName;
  const getProfile = deps.getProfile ?? getMechanicsProfile;
  const scoreMechanics =
    deps.scoreMechanics ??
    (async (c: ScryfallCard) => {
      const { analyzeMechanics } = await import("@/lib/mechanics-analyzer");
      return analyzeMechanics(c);
    });
  const saveProfile = deps.saveProfile ?? upsertMechanicsProfile;

  let scored = 0;
  const errors: string[] = [];
  const unique = [...new Set(cardNames)];

  for (const name of unique) {
    try {
      const card = await getCard(name);
      const existing = await getProfile(card.id);
      if (existing && !isStale(existing)) continue;
      const profile = await scoreMechanics(card);
      await saveProfile(profile);
      scored++;
    } catch (err) {
      errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { scored, errors };
}
