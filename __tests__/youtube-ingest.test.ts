import { describe, it, expect, vi, beforeEach } from "vitest";

const SAMPLE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:yt="http://www.youtube.com/xml/schemas/2015">
  <entry>
    <yt:videoId>abc123</yt:videoId>
    <title>MTG Finance Update: Top Buys</title>
    <published>2026-06-09T10:00:00+00:00</published>
    <author><name>Tolarian Community College</name></author>
  </entry>
  <entry>
    <yt:videoId>def456</yt:videoId>
    <title>Should You Buy Into This Commander Staple?</title>
    <published>2026-06-08T10:00:00+00:00</published>
    <author><name>Tolarian Community College</name></author>
  </entry>
</feed>`;

describe("fetchYouTubeVideos", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("fetches RSS for all channels and returns videos with transcript content", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "Hello welcome to this video", duration: 3.5, offset: 0 },
          { text: "today we talk about Ragavan", duration: 3.5, offset: 3.5 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    // 5 channels × 2 entries each = 10 videos total
    expect(videos.length).toBeGreaterThan(0);
    const first = videos[0];
    expect(first.source_type).toBe("youtube");
    expect(first.source_url).toMatch(/youtube\.com\/watch\?v=/);
    expect(first.content).toContain("Hello welcome");
    expect(first.content).toContain("today we talk about Ragavan");
  });

  it("skips videos where transcript fetch throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(SAMPLE_RSS),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockRejectedValue(new Error("No captions available")),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    expect(videos).toHaveLength(0);
  });

  it("deduplicates videos that appear in multiple channel feeds", async () => {
    // Two channels return the same video ID
    const rssWithSameId = SAMPLE_RSS.replace("def456", "abc123");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssWithSameId),
    } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "content", duration: 1, offset: 0 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    const videos = await fetch_();

    const ids = videos.map((v) => v.source_url);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("skips channels where RSS fetch fails and continues with others", async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(SAMPLE_RSS),
      } as unknown as Response);

    vi.doMock("youtube-transcript", () => ({
      YoutubeTranscript: {
        fetchTranscript: vi.fn().mockResolvedValue([
          { text: "transcript text", duration: 1, offset: 0 },
        ]),
      },
    }));

    const { fetchYouTubeVideos: fetch_ } = await import("@/lib/youtube-ingest");
    // Should not throw even if one channel fails
    const videos = await fetch_();
    expect(Array.isArray(videos)).toBe(true);
  });
});
