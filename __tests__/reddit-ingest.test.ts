import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRedditPosts, type RedditPost } from "@/lib/reddit-ingest";

const mockPost = (overrides: Partial<RedditPost["data"]> = {}) => ({
  id: "abc123",
  title: "Ragavan is a great buy right now",
  url: "https://reddit.com/r/mtgfinance/abc123",
  selftext: "I've been watching the price and think it's undervalued.",
  score: 142,
  subreddit: "mtgfinance",
  created_utc: 1748985600,
  permalink: "/r/mtgfinance/comments/abc123/ragavan_post/",
  ...overrides,
});

const makePullPushResponse = (posts: ReturnType<typeof mockPost>[]) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({ data: posts }),
});

describe("fetchRedditPosts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches top posts from both subreddits", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makePullPushResponse([mockPost()]))
      .mockResolvedValueOnce(makePullPushResponse([mockPost({ id: "def456", subreddit: "magicTCG" })]));
    vi.stubGlobal("fetch", fetchMock);

    const posts = await fetchRedditPosts();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("mtgfinance"));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("magicTCG"));
    expect(posts).toHaveLength(2);
  });

  it("returns normalized RedditPost objects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makePullPushResponse([mockPost()])));

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0]).toMatchObject({
      id: "abc123",
      title: "Ragavan is a great buy right now",
      score: 142,
      subreddit: "mtgfinance",
    });
    expect(posts[0].url).toContain("reddit.com");
    expect(posts[0].created_utc).toBeInstanceOf(Date);
  });

  it("silently skips a subreddit that returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(makePullPushResponse([mockPost({ subreddit: "magicTCG" })]))
    );

    const posts = await fetchRedditPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].subreddit).toBe("magicTCG");
  });

  it("deduplicates posts with the same id across subreddits", async () => {
    const duplicate = mockPost({ id: "same123" });
    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(makePullPushResponse([duplicate]))
        .mockResolvedValueOnce(makePullPushResponse([duplicate]))
    );

    const posts = await fetchRedditPosts();

    expect(posts).toHaveLength(1);
  });

  it("combines title and body into full_text for analysis", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makePullPushResponse([mockPost()])));

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0].full_text).toContain("Ragavan is a great buy right now");
    expect(posts[0].full_text).toContain("I've been watching the price");
  });

  it("uses permalink for post URL when available", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(makePullPushResponse([
      mockPost({ permalink: "/r/mtgfinance/comments/abc123/ragavan_post/" })
    ])));

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0].url).toBe("https://reddit.com/r/mtgfinance/comments/abc123/ragavan_post/");
  });
});
