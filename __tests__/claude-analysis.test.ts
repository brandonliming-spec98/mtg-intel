import { describe, it, expect, vi, afterEach } from "vitest";
import { extractSignalsFromText, type AnalysisInput } from "@/lib/claude-analysis";

const makeClient = (responseText: string) => ({
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: responseText }],
    }),
  },
});

const baseInput: AnalysisInput = {
  content: "Ragavan is insane right now, definitely bullish.",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Ragavan hitting new highs",
  published_at: "2026-06-04T12:00:00Z",
};

describe("extractSignalsFromText", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns empty array when no client is provided and ANTHROPIC_API_KEY is absent", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const signals = await extractSignalsFromText(baseInput);
    expect(signals).toEqual([]);
  });


  it("returns parsed signals when Claude returns valid JSON", async () => {
    const claude = makeClient(
      JSON.stringify([
        {
          card_name: "Ragavan, Nimble Pilferer",
          sentiment: "bullish",
          signal_strength: 8,
          reason: "Community considers it underpriced for its power level",
          excerpt: "Ragavan is insane right now, definitely bullish.",
        },
      ])
    );

    const signals = await extractSignalsFromText(baseInput, claude as never);

    expect(signals).toHaveLength(1);
    expect(signals[0].card_name_raw).toBe("Ragavan, Nimble Pilferer");
    expect(signals[0].sentiment).toBe("bullish");
    expect(signals[0].signal_strength).toBe(8);
    expect(signals[0].source_type).toBe("reddit");
    expect(signals[0].source_url).toBe(baseInput.source_url);
    expect(signals[0].source_title).toBe(baseInput.source_title);
    expect(signals[0].published_at).toBe(baseInput.published_at);
    expect(signals[0].summary).toBe("Community considers it underpriced for its power level");
    expect(signals[0].id).toBeTruthy();
  });

  it("returns empty array when Claude reports no card mentions", async () => {
    const claude = makeClient(JSON.stringify([]));
    const signals = await extractSignalsFromText(baseInput, claude as never);
    expect(signals).toEqual([]);
  });

  it("returns empty array when Claude returns malformed JSON", async () => {
    const claude = makeClient("I cannot analyze this content.");
    const signals = await extractSignalsFromText(baseInput, claude as never);
    expect(signals).toEqual([]);
  });

  it("returns empty array when Claude wraps JSON in markdown code fences", async () => {
    const claude = makeClient(
      "```json\n" +
        JSON.stringify([
          {
            card_name: "Black Lotus",
            sentiment: "bullish",
            signal_strength: 10,
            reason: "Reserved List card, always appreciates",
            excerpt: "Black Lotus forever.",
          },
        ]) +
        "\n```"
    );
    const signals = await extractSignalsFromText(baseInput, claude as never);
    expect(signals).toHaveLength(1);
    expect(signals[0].card_name_raw).toBe("Black Lotus");
  });

  it("passes the correct system prompt to Claude", async () => {
    const claude = makeClient(JSON.stringify([]));
    await extractSignalsFromText(baseInput, claude as never);

    const call = (claude.messages.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.system).toContain("MTG finance analyst");
    expect(call.messages[0].content).toContain(baseInput.content);
    expect(call.messages[0].content).toContain("reddit");
  });

  it("generates a unique id for each signal", async () => {
    const twoSignals = [
      { card_name: "Ragavan, Nimble Pilferer", sentiment: "bullish", signal_strength: 8, reason: "r1", excerpt: "e1" },
      { card_name: "Black Lotus", sentiment: "neutral", signal_strength: 5, reason: "r2", excerpt: "e2" },
    ];
    const claude = makeClient(JSON.stringify(twoSignals));
    const signals = await extractSignalsFromText(baseInput, claude as never);

    expect(signals[0].id).not.toBe(signals[1].id);
  });
});
