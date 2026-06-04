import { ScryfallCard, ScryfallSearchResult, ScryfallRuling, ScryfallSet } from "@/types";

const BASE = "https://api.scryfall.com";
const HEADERS = {
  "User-Agent": "MTGIntel/1.0 (mtgintel.app)",
  "Accept": "application/json",
};

async function scryfallFetch<T>(path: string): Promise<T> {
  // Rate limit: Scryfall requests 50-100ms between calls
  await new Promise(r => setTimeout(r, 75));
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS, next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`Scryfall ${path}: ${res.status}`);
  return res.json();
}

export async function searchCards(query: string, page = 1): Promise<ScryfallSearchResult> {
  const encoded = encodeURIComponent(query);
  return scryfallFetch<ScryfallSearchResult>(`/cards/search?q=${encoded}&page=${page}&order=edhrec`);
}

export async function getCardById(id: string): Promise<ScryfallCard> {
  return scryfallFetch<ScryfallCard>(`/cards/${id}`);
}

export async function getCardByName(name: string): Promise<ScryfallCard> {
  const encoded = encodeURIComponent(name);
  return scryfallFetch<ScryfallCard>(`/cards/named?fuzzy=${encoded}`);
}

export async function getCardRulings(id: string): Promise<ScryfallRuling[]> {
  const res = await scryfallFetch<{ data: ScryfallRuling[] }>(`/cards/${id}/rulings`);
  return res.data;
}

export async function getCardPrints(name: string): Promise<ScryfallCard[]> {
  const encoded = encodeURIComponent(`!"${name}"`);
  const res = await scryfallFetch<ScryfallSearchResult>(`/cards/search?q=${encoded}&unique=prints&order=released`);
  return res.data;
}

export async function getSet(code: string): Promise<ScryfallSet> {
  return scryfallFetch<ScryfallSet>(`/sets/${code}`);
}

export async function getRandomCard(): Promise<ScryfallCard> {
  return scryfallFetch<ScryfallCard>("/cards/random");
}

// Autocomplete for search suggestions
export async function autocomplete(query: string): Promise<string[]> {
  if (query.length < 2) return [];
  const encoded = encodeURIComponent(query);
  const res = await scryfallFetch<{ data: string[] }>(`/cards/autocomplete?q=${encoded}`);
  return res.data.slice(0, 8);
}

export function getCardImage(card: ScryfallCard, size: "small" | "normal" | "large" | "art_crop" = "normal"): string {
  if (card.image_uris) return card.image_uris[size];
  if (card.card_faces?.[0]?.image_uris) return card.card_faces[0].image_uris[size];
  return "/card-placeholder.png";
}

export function formatManaCost(manaCost: string): string[] {
  // Returns array of symbols like ["W", "U", "2"]
  return (manaCost || "").replace(/[{}]/g, " ").trim().split(/\s+/).filter(Boolean);
}

export function rarityColor(rarity: string): string {
  const map: Record<string, string> = {
    mythic: "#e8732a",
    rare: "#d4a843",
    uncommon: "#a0aec0",
    common: "#e2e8f0",
  };
  return map[rarity] ?? "#e2e8f0";
}
