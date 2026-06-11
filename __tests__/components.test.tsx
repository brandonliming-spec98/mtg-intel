import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreRing from "@/components/ScoreRing";
import CardTiltHero from "@/components/CardTiltHero";
import type { ScryfallCard } from "@/types";

const mockCard: ScryfallCard = {
  id: "abc",
  name: "Force of Will",
  set: "all",
  set_name: "Alliances",
  collector_number: "1",
  rarity: "uncommon",
  cmc: 5,
  type_line: "Instant",
  color_identity: ["U"],
  legalities: {},
  prices: { usd: "89.50", usd_foil: "120.00" },
  image_uris: {
    small: "/img.jpg", normal: "/img.jpg", large: "/img.jpg",
    art_crop: "/img.jpg", border_crop: "/img.jpg",
  },
  released_at: "1996-06-01",
  reserved: false,
  reprint: false,
  foil: false,
  nonfoil: true,
  uri: "",
  scryfall_uri: "",
};

describe("ScoreRing", () => {
  it("renders the score value", () => {
    render(<ScoreRing score={94} />);
    expect(screen.getByText("94")).toBeTruthy();
  });

  it("clamps score to 0-100", () => {
    render(<ScoreRing score={150} />);
    expect(screen.getByText("100")).toBeTruthy();
  });
});

describe("CardTiltHero", () => {
  it("renders the card image", () => {
    render(<CardTiltHero card={mockCard} />);
    const img = document.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.alt).toBe("Force of Will");
  });

  it("adds foil class when foil prop is true", () => {
    const { container } = render(<CardTiltHero card={mockCard} foil />);
    expect(container.querySelector(".card-hero-foil")).toBeTruthy();
  });

  it("does not add foil class when foil prop is false", () => {
    const { container } = render(<CardTiltHero card={mockCard} foil={false} />);
    expect(container.querySelector(".card-hero-foil")).toBeNull();
  });
});
