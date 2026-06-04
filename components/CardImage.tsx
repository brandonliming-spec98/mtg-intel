"use client";
import { useState } from "react";
import { ScryfallCard } from "@/types";
import { getCardImage } from "@/lib/scryfall";

interface Props {
  card: ScryfallCard;
  size?: "small" | "normal" | "large";
  className?: string;
  showBack?: boolean;
}

export default function CardImage({ card, size = "normal", className = "", showBack = false }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const isDoubleFaced = !!card.card_faces?.[1]?.image_uris;

  const frontImg = getCardImage(card, size);
  const backImg = isDoubleFaced ? (card.card_faces![1].image_uris![size] ?? frontImg) : frontImg;
  const src = flipped ? backImg : frontImg;

  return (
    <div className={`relative group ${className}`}>
      {!loaded && (
        <div className="absolute inset-0 skeleton rounded-xl" />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={card.name}
        onLoad={() => setLoaded(true)}
        className={`w-full rounded-xl transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ aspectRatio: "2.5/3.5" }}
      />
      {isDoubleFaced && showBack && (
        <button
          onClick={() => setFlipped(f => !f)}
          className="absolute bottom-2 right-2 bg-bg-elevated/90 border border-bg-border text-xs text-gold px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ⟳ Flip
        </button>
      )}
    </div>
  );
}
