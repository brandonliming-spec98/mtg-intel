import { describe, it, expect, vi } from "vitest";
import { runYouTubeIngestion, type YouTubeIngestResult } from "@/lib/ingest-youtube";
import type { IntelSignal } from "@/types";

const makeSignal = (overrides: Partial<IntelSignal> = {}): IntelSignal => ({
  id: "sig-1",
  card_name_raw: "Ragavan, Nimble Pilferer",
  source_type: "youtube",
  source_url: "https://youtube.com/watch?v=abc123",
  source_title: "Tolarian Community College: MTG Finance Update",
  sentiment: "bullish",
  signal_strength: 8,
  summary: "Underpriced for its power level",
  published_at: "2026-06-09T10:00:00Z",
  ...overrides,
});

const makeVideo = () => ({
  content: "Ragavan, Nimble Pilferer is a great buy right now at this price point.",
  source_type: "youtube" as const,
  source_url: "https://youtube.com/watch?v=abc123",
  source_title: "Tolarian Community College: MTG Finance Update",
  published_at: "2026-06-09T10:00:00Z",
});

describe("runYouTubeIngestion", () => {
  it("returns videosProcessed count and signalsFound", async () => {
    const signals = [makeSignal()];
    const result = await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.videosProcessed).toBe(1);
    expect(result.signalsFound).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("calls analyzeText with video content and metadata", async () => {
    const analyzeText = vi.fn().mockResolvedValue([]);
    const video = makeVideo();

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([video]),
      analyzeText,
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(analyzeText).toHaveBeenCalledWith(video);
  });

  it("calls storeSignals once with all signals from all videos", async () => {
    const storeSignals = vi.fn().mockResolvedValue(undefined);
    const signals = [makeSignal()];

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo(), makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue(signals),
      storeSignals,
    });

    expect(storeSignals).toHaveBeenCalledOnce();
    expect(storeSignals.mock.calls[0][0]).toHaveLength(2);
  });

  it("does not call storeSignals when no signals found", async () => {
    const storeSignals = vi.fn().mockResolvedValue(undefined);

    await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockResolvedValue([]),
      storeSignals,
    });

    expect(storeSignals).not.toHaveBeenCalled();
  });

  it("records error and continues when analyzeText throws for a video", async () => {
    const result = await runYouTubeIngestion({
      fetchVideos: vi.fn().mockResolvedValue([makeVideo()]),
      analyzeText: vi.fn().mockRejectedValue(new Error("Claude rate limit")),
      storeSignals: vi.fn().mockResolvedValue(undefined),
    });

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("abc123");
  });
});
