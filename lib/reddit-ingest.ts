const DEFAULT_SUBREDDITS = ["mtgfinance", "magicTCG"];

// Reddit blocks datacenter JSON requests (403) and PullPush returns empty data,
// but the public Atom feeds remain open. Scores are not present in RSS, so
// score is always 0 and analysis takes the rule-based path.
const FEED_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  body: string;
  full_text: string;
  score: number;
  subreddit: string;
  created_utc: Date;
  data: {
    id: string;
    title: string;
    url: string;
    selftext: string;
    score: number;
    subreddit: string;
    created_utc: number;
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#3[29];/g, "'")
    .replace(/&amp;#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function htmlToText(html: string): string {
  const decoded = decodeEntities(decodeEntities(html));
  const text = decoded
    .replace(/<[^>]+>/g, " ")
    .replace(/\[link\]|\[comments\]|submitted by|\/u\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Link-only posts reduce to leftover punctuation — treat as empty
  return /[a-zA-Z0-9]/.test(text) ? text : "";
}

function tag(entry: string, name: string): string | null {
  const m = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : null;
}

function parseFeed(xml: string, fallbackSubreddit: string): RedditPost[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  const posts: RedditPost[] = [];

  for (const entry of entries) {
    const rawId = tag(entry, "id") ?? "";
    const id = rawId.replace(/^t3_/, "");
    const title = decodeEntities(tag(entry, "title") ?? "");
    const linkMatch = entry.match(/<link href="([^"]*)"/);
    const url = linkMatch ? decodeEntities(linkMatch[1]) : "";
    const updated = tag(entry, "updated");
    const content = tag(entry, "content") ?? "";
    if (!id || !title) continue;

    const subreddit = url.match(/\/r\/([^/]+)\//)?.[1] ?? fallbackSubreddit;
    const body = htmlToText(content);
    const created = updated ? new Date(updated) : new Date();

    posts.push({
      id,
      title,
      url,
      body,
      full_text: [title, body].filter(Boolean).join("\n\n"),
      score: 0,
      subreddit,
      created_utc: created,
      data: {
        id,
        title,
        url,
        selftext: body,
        score: 0,
        subreddit,
        created_utc: Math.floor(created.getTime() / 1000),
      },
    });
  }

  return posts;
}

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const url = `https://www.reddit.com/r/${subreddit}/top/.rss?t=day&limit=25`;
  const res = await fetch(url, { headers: FEED_HEADERS });
  if (!res.ok) return [];

  const xml = await res.text();
  return parseFeed(xml, subreddit);
}

export async function fetchRedditPosts(
  subreddits: string[] = DEFAULT_SUBREDDITS
): Promise<RedditPost[]> {
  const results = await Promise.all(subreddits.map(fetchSubreddit));
  const seen = new Set<string>();
  const deduped: RedditPost[] = [];
  for (const post of results.flat()) {
    if (!seen.has(post.id)) {
      seen.add(post.id);
      deduped.push(post);
    }
  }
  return deduped;
}
