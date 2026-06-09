import { describe, it, expect, vi, beforeEach } from "vitest";
import { runRedditIngestion, type IngestResult } from "@/lib/ingest-reddit";
import type { IntelSignal } from "@/types";

const makeSignal = (overrides: Partial<IntelSignal> = {}): IntelSignal => ({
  id: "sig-1",
  card_name_raw: "Ragavan, Nimble Pilferer",
  source_type: "reddit",
  source_url: "https://reddit.com/r/mtgfinance/abc",
  source_title: "Ragavan is a great buy",
  sentiment: "bullish",
  signal_strength: 8,
  summary: "Underpriced for its power level",
  published_at: "2026-06-04T12:00:00Z",
  ...overrides,
});

describe("runRedditIngestion", () => {
  it("returns processed count matching signals found", async () => {
    const signals = [makeSignal(), makeSignal({ id: "sig-2", card_name_raw: "Black Lotus" })];

    const result = await runRedditIngestion({
      fetchPosts: vi.fn().mockResolvedValue([
        {
          id: "post1",
          title: "Buy Ragavan",
          full_text: "Ragavan is cheap",
          url: "https://reddit.com/r/mtgfinance/post1",
          subreddit: "mtgfinance",
          score: 50,
          created_utc: new Date("2026-06-04T12:00:00Z"),
        },
      ]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.postsProcessed).toBe(1);
    expect(result.signalsFound).toBe(2);
  });

  it("calls analyzeText with full_text and correct metadata", async () => {
    const analyzeText = vi.fn().mockResolvedValue([]);
    const post = {
      id: "post1",
      title: "Ragavan is cheap",
      full_text: "The full text content",
      url: "https://reddit.com/r/mtgfinance/post1",
      subreddit: "mtgfinance",
      score: 50,
      created_utc: new Date("2026-06-04T12:00:00Z"),
    };

    await runRedditIngestion({
      fetchPosts: vi.fn().mockResolvedValue([post]),
      analyzeText,
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(analyzeText).toHaveBeenCalledWith({
      content: post.full_text,
      source_type: "reddit",
      source_url: post.url,
      source_title: post.title,
      published_at: expect.any(String),
      score: post.score,
    });
  });

  it("calls storeSignals with all signals from all posts", async () => {
    const storeSignals = vi.fn().mockResolvedValue(undefined);
    const signals = [makeSignal()];

    await runRedditIngestion({
      fetchPosts: vi.fn().mockResolvedValue([
        { id: "p1", title: "t1", full_text: "f1", url: "u1", subreddit: "mtgfinance", score: 1, created_utc: new Date() },
        { id: "p2", title: "t2", full_text: "f2", url: "u2", subreddit: "mtgfinance", score: 1, created_utc: new Date() },
      ]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals,
    });

    expect(storeSignals).toHaveBeenCalledOnce();
    expect(storeSignals.mock.calls[0][0]).toHaveLength(2);
  });

  it("skips posts that produce no signals without failing", async () => {
    const result = await runRedditIngestion({
      fetchPosts: vi.fn().mockResolvedValue([
        { id: "p1", title: "t1", full_text: "f1", url: "u1", subreddit: "mtgfinance", score: 1, created_utc: new Date() },
      ]),
      analyzeText: vi.fn().mockResolvedValue([]),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.signalsFound).toBe(0);
    expect(result.postsProcessed).toBe(1);
  });

  it("returns errors array when analyzeText throws for a post", async () => {
    const result = await runRedditIngestion({
      fetchPosts: vi.fn().mockResolvedValue([
        { id: "p1", title: "t1", full_text: "f1", url: "u1", subreddit: "mtgfinance", score: 1, created_utc: new Date() },
      ]),
      analyzeText: vi.fn().mockRejectedValue(new Error("Claude rate limit")),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("p1");
  });
});
