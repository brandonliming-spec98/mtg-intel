import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreRing from "@/components/ScoreRing";

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
