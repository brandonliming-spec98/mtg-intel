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

import { fireEvent } from "@testing-library/react";
import IntelPanel from "@/components/IntelPanel";
import type { IntelSignal } from "@/types";

function makeSignal(i: number, sentiment: "bullish" | "bearish" = "bullish"): IntelSignal {
  return {
    id: `sig-${i}`,
    card_name_raw: "Force of Will",
    source_type: "reddit",
    source_url: "https://reddit.com",
    source_title: `Post ${i}`,
    sentiment,
    signal_strength: 8,
    summary: `Quote text number ${i}`,
    published_at: new Date().toISOString(),
  };
}

const subScores = { volume: 28, sentiment: 24, momentum: 15, scarcity: 10 };

describe("IntelPanel", () => {
  it("renders score ring with overall score", () => {
    render(<IntelPanel signals={[makeSignal(1)]} score={77} subScores={subScores} />);
    expect(screen.getByText("77")).toBeTruthy();
  });

  it("shows first 4 quotes by default", () => {
    const signals = Array.from({ length: 6 }, (_, i) => makeSignal(i));
    render(<IntelPanel signals={signals} score={80} subScores={subScores} />);
    expect(screen.getByText(/Quote text number 0/)).toBeTruthy();
    expect(screen.getByText(/Quote text number 3/)).toBeTruthy();
    expect(screen.queryByText(/Quote text number 4/)).toBeNull();
  });

  it("shows expand button when more than 4 signals", () => {
    const signals = Array.from({ length: 6 }, (_, i) => makeSignal(i));
    render(<IntelPanel signals={signals} score={80} subScores={subScores} />);
    expect(screen.getByText(/2 more sources/)).toBeTruthy();
  });

  it("expands on button click", () => {
    const signals = Array.from({ length: 6 }, (_, i) => makeSignal(i));
    render(<IntelPanel signals={signals} score={80} subScores={subScores} />);
    fireEvent.click(screen.getByText(/2 more sources/));
    expect(screen.getByText(/Quote text number 4/)).toBeTruthy();
  });

  it("renders empty state when no signals", () => {
    render(<IntelPanel signals={[]} score={0} subScores={{ volume: 0, sentiment: 0, momentum: 0, scarcity: 0 }} />);
    expect(screen.getByText(/No signals yet/)).toBeTruthy();
  });
});
