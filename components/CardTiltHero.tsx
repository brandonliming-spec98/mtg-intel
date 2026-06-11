"use client";
import { useRef, useEffect } from "react";
import type { ScryfallCard } from "@/types";

function shadowColor(colors: string[]): string {
  if (!colors?.length) return "rgba(150,150,150,0.3)";
  if (colors.length > 1) return "rgba(212,175,55,0.4)";
  const map: Record<string, string> = {
    W: "rgba(255,255,255,0.3)",
    U: "rgba(88,166,255,0.4)",
    B: "rgba(168,85,247,0.4)",
    R: "rgba(239,68,68,0.4)",
    G: "rgba(34,197,94,0.4)",
  };
  return map[colors[0]] ?? "rgba(150,150,150,0.3)";
}

interface Props {
  card: ScryfallCard;
  foil?: boolean;
}

export default function CardTiltHero({ card, foil }: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const imageUrl =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;
  const shadow = shadowColor(card.color_identity);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches) return;

    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      el.style.transition = "transform 0.1s ease-out";
      el.style.transform = `perspective(600px) rotateX(${-dy * 15}deg) rotateY(${dx * 15}deg)`;
    };

    const handleLeave = () => {
      el.style.transition = "transform 0.4s ease-out";
      el.style.transform =
        "perspective(600px) rotateX(0deg) rotateY(0deg)";
    };

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  return (
    <div className="flex justify-center items-start py-4">
      <div
        ref={innerRef}
        className={`relative rounded-[8px] overflow-hidden${foil ? " card-hero-foil" : ""}`}
        style={{
          width: 280,
          height: 390,
          boxShadow: `0 16px 48px ${shadow}`,
          background: "linear-gradient(135deg, #1a1a2e, #16213e)",
        }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={card.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        )}
      </div>
    </div>
  );
}
