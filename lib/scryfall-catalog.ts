let catalog: Set<string> | null = null;

export async function getCardCatalog(): Promise<Set<string>> {
  if (catalog) return catalog;
  // Scryfall rejects requests without a User-Agent and Accept header (400)
  const res = await fetch("https://api.scryfall.com/catalog/card-names", {
    headers: {
      "User-Agent": "MTGIntel/1.0 (mtgintel.app)",
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Scryfall catalog fetch failed: ${res.status}`);
  const json = await res.json() as { data: string[] };
  catalog = new Set(json.data);
  return catalog;
}
