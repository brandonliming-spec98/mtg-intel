"use client";
import Link from "next/link";
import { ScryfallCard } from "@/types";
import RarityBadge from "./RarityBadge";
import { getCardImage, rarityColor } from "@/lib/scryfall";
import { formatPrice } from "@/lib/price-sources";

interface Props {
  cards: ScryfallCard[];
  loading?: boolean;
}

function CardSkeleton() {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl overflow-hidden">
      <div className="skeleton" style={{ aspectRatio: "2.5/3.5" }} />
      <div className="p-3 space-y-2">
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/2" />
      </div>
    </div>
  );
}

function CardTile({ card }: { card: ScryfallCard }) {
  const price = card.prices?.usd ? parseFloat(card.prices.usd) : null;
  const img = getCardImage(card, "normal");
  const borderColor = rarityColor(card.rarity);

  return (
    <Link href={`/cards/${card.id}`} className="block group">
      <div
        className="bg-bg-card rounded-xl overflow-hidden card-hover border transition-all duration-200"
        style={{ borderColor: "var(--border)" }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = `${borderColor}60`)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        {/* Card Image */}
        <div className="relative overflow-hidden" style={{ aspectRatio: "2.5/3.5" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img}
            alt={card.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            loading="lazy"
          />
          {/* Price overlay */}
          {price !== null && (
            <div className="absolute bottom-2 right-2 bg-bg-primary/85 backdrop-blur-sm border border-bg-border rounded-md px-2 py-1">
              <span className="text-sm font-mono font-bold text-gold">{formatPrice(price)}</span>
            </div>
          )}
        </div>

        {/* Card Info */}
        <div className="p-3">
          <div className="font-display text-sm font-semibold text-white leading-tight truncate mb-1">
            {card.name}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral font-mono">{card.set_name}</span>
            <RarityBadge rarity={card.rarity} />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function CardGrid({ cards, loading }: Props) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 animate-fade-in">
      {cards.map(card => <CardTile key={card.id} card={card} />)}
    </div>
  );
}
