import type { IntelSignal, ScryfallCard, MechanicsProfile } from "@/types";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { RedditPost } from "@/lib/reddit-ingest";

interface IngestDeps {
  fetchPosts: (subreddits?: string[]) => Promise<RedditPost[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
  scoreMechanics?: (card: ScryfallCard) => Promise<MechanicsProfile>;
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

    if (deps.scoreMechanics) {
      const cardNames = [...new Set(allSignals.map((s) => s.card_name_raw).filter(Boolean) as string[])];
      if (cardNames.length > 0) {
        try {
          const { scoreNewCards } = await import(/* @vite-ignore */ ["@/lib/mechanics-profiles"].join(""));
          const scoreResult = await scoreNewCards(cardNames, {
            scoreMechanics: deps.scoreMechanics,
          });
          errors.push(...scoreResult.errors);
        } catch (err) {
          errors.push(`mechanics-scoring: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }
  }

  return {
    postsProcessed: posts.length,
    signalsFound: allSignals.length,
    errors,
  };
}
