import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchRedditPosts, type RedditPost } from "@/lib/reddit-ingest";

interface RssEntry {
  id?: string;
  title?: string;
  link?: string;
  content?: string;
  updated?: string;
}

const makeEntry = (overrides: RssEntry = {}) => ({
  id: "t3_abc123",
  title: "Ragavan is a great buy right now",
  link: "https://www.reddit.com/r/mtgfinance/comments/abc123/ragavan_post/",
  content:
    "&lt;p&gt;I&amp;#39;ve been watching the price and think it&amp;#39;s undervalued.&lt;/p&gt;",
  updated: "2026-06-12T07:08:16+00:00",
  ...overrides,
});

const entryXml = (e: ReturnType<typeof makeEntry>) =>
  `<entry><id>${e.id}</id><title>${e.title}</title>` +
  `<link href="${e.link}" /><updated>${e.updated}</updated>` +
  `<content type="html">${e.content}</content></entry>`;

const makeRssResponse = (entries: ReturnType<typeof makeEntry>[]) => ({
  ok: true,
  text: vi
    .fn()
    .mockResolvedValue(
      `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom">` +
        entries.map(entryXml).join("") +
        `</feed>`
    ),
});

describe("fetchRedditPosts", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("fetches the top RSS feed from both subreddits", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeRssResponse([makeEntry()]))
      .mockResolvedValueOnce(
        makeRssResponse([
          makeEntry({
            id: "t3_def456",
            link: "https://www.reddit.com/r/magicTCG/comments/def456/post/",
          }),
        ])
      );
    vi.stubGlobal("fetch", fetchMock);

    const posts = await fetchRedditPosts();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/r/mtgfinance/top/.rss"),
      expect.anything()
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/r/magicTCG/top/.rss"),
      expect.anything()
    );
    expect(posts).toHaveLength(2);
  });

  it("returns normalized RedditPost objects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeRssResponse([makeEntry()]))
    );

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0]).toMatchObject({
      id: "abc123",
      title: "Ragavan is a great buy right now",
      score: 0,
      subreddit: "mtgfinance",
    });
    expect(posts[0].url).toContain("reddit.com");
    expect(posts[0].created_utc).toBeInstanceOf(Date);
  });

  it("strips HTML and decodes entities in the post body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeRssResponse([makeEntry()]))
    );

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0].body).toContain(
      "I've been watching the price and think it's undervalued."
    );
    expect(posts[0].body).not.toContain("<p>");
    expect(posts[0].body).not.toContain("&lt;");
  });

  it("silently skips a subreddit that returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce(
          makeRssResponse([
            makeEntry({
              id: "t3_def456",
              link: "https://www.reddit.com/r/magicTCG/comments/def456/post/",
            }),
          ])
        )
    );

    const posts = await fetchRedditPosts();

    expect(posts).toHaveLength(1);
    expect(posts[0].subreddit).toBe("magicTCG");
  });

  it("deduplicates posts with the same id across subreddits", async () => {
    const duplicate = makeEntry({ id: "t3_same123" });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(makeRssResponse([duplicate]))
        .mockResolvedValueOnce(makeRssResponse([duplicate]))
    );

    const posts = await fetchRedditPosts();

    expect(posts).toHaveLength(1);
  });

  it("combines title and body into full_text for analysis", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(makeRssResponse([makeEntry()]))
    );

    const posts = await fetchRedditPosts(["mtgfinance"]);

    expect(posts[0].full_text).toContain("Ragavan is a great buy right now");
    expect(posts[0].full_text).toContain("I've been watching the price");
  });

  it("derives the subreddit from the entry link", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeRssResponse([
          makeEntry({
            link: "https://www.reddit.com/r/magicTCG/comments/xyz/post/",
          }),
        ])
      )
    );

    const posts = await fetchRedditPosts(["magicTCG"]);

    expect(posts[0].subreddit).toBe("magicTCG");
  });
});
