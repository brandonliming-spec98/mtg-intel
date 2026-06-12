const DEFAULT_SUBREDDITS = ["mtgfinance", "magicTCG"];
const BASE_URL = "https://api.pullpush.io/reddit/search/submission";

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

interface RawPost {
  id: string;
  title: string;
  url: string;
  selftext?: string;
  score: number;
  subreddit: string;
  created_utc: number;
  permalink?: string;
}

async function fetchSubreddit(subreddit: string): Promise<RedditPost[]> {
  const since = Math.floor(Date.now() / 1000) - 86400; // last 24h
  const url = `${BASE_URL}/?subreddit=${subreddit}&sort=score&order=desc&limit=25&after=${since}`;
  const res = await fetch(url);
  if (!res.ok) return [];

  const json = await res.json() as { data?: RawPost[] };
  const posts = json.data ?? [];

  return posts.map((d) => {
    const full_text = [d.title, d.selftext].filter(Boolean).join("\n\n");
    const postUrl = d.permalink
      ? `https://reddit.com${d.permalink}`
      : d.url;
    return {
      id: d.id,
      title: d.title,
      url: postUrl,
      body: d.selftext ?? "",
      full_text,
      score: d.score,
      subreddit: d.subreddit,
      created_utc: new Date(d.created_utc * 1000),
      data: {
        id: d.id,
        title: d.title,
        url: postUrl,
        selftext: d.selftext ?? "",
        score: d.score,
        subreddit: d.subreddit,
        created_utc: d.created_utc,
      },
    };
  });
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
