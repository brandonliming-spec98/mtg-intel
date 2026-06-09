import type { IntelSignal } from "@/types";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { RedditPost } from "@/lib/reddit-ingest";

interface IngestDeps {
  fetchPosts: (subreddits?: string[]) => Promise<RedditPost[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
}

export interface IngestResult {
  postsProcessed: number;
  signalsFound: number;
  errors: string[];
}

export async function runRedditIngestion(deps: IngestDeps): Promise<IngestResult> {
  const posts = await deps.fetchPosts();
  const allSignals: IntelSignal[] = [];
  const errors: string[] = [];

  for (const post of posts) {
    try {
      const signals = await deps.analyzeText({
        content: post.full_text,
        source_type: "reddit",
        source_url: post.url,
        source_title: post.title,
        published_at: post.created_utc.toISOString(),
        score: post.score,
      });
      allSignals.push(...signals);
    } catch (err) {
      errors.push(`${post.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allSignals.length > 0) {
    await deps.storeSignals(allSignals);
  }

  return {
    postsProcessed: posts.length,
    signalsFound: allSignals.length,
    errors,
  };
}
