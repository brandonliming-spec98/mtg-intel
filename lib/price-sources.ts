/**
 * Unified price interface.
 * This abstraction layer is intentionally simple now.
 * Adding TCGPlayer in Phase 4 = implement adapter + add to getPriceWithFallback().
 * No other files need to change.
 */

import { CardPriceData } from "@/types";
import { getScryfallPriceData } from "./scryfall";

export async function getPriceWithFallback(cardName: string): Promise<CardPriceData | null> {
  // Primary: Scryfall. MTGStocks removed their public API (2026-06) and the
  // MTGGoldfish name-only price URL 404s, so Scryfall is the one solid source.
  return getScryfallPriceData(cardName);
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) return "—";
  return `$${price.toFixed(2)}`;
}

export function getPriceChangeClass(change: number): string {
  if (change > 0) return "price-up";
  if (change < 0) return "price-down";
  return "price-flat";
}

export function getPriceChangeLabel(oldPrice: number, newPrice: number): string {
  if (!oldPrice) return "";
  const pct = ((newPrice - oldPrice) / oldPrice) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}
