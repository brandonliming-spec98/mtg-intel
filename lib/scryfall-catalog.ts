let catalog: Set<string> | null = null;

export async function getCardCatalog(): Promise<Set<string>> {
  if (catalog) return catalog;
  const res = await fetch("https://api.scryfall.com/catalog/card-names");
  if (!res.ok) throw new Error(`Scryfall catalog fetch failed: ${res.status}`);
  const json = await res.json() as { data: string[] };
  catalog = new Set(json.data);
  return catalog;
}
