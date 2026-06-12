// Manual trigger for the Reddit ingestion pipeline (same flow as /api/ingest/reddit).
// Run: npx tsx --env-file=.env.local scripts/run-reddit-ingest.ts
import { runRedditIngestion } from "../lib/ingest-reddit";
import { fetchRedditPosts } from "../lib/reddit-ingest";
import { hybridAnalyze } from "../lib/hybrid-analysis";
import { storeSignals } from "../lib/supabase-signals";

runRedditIngestion({
  fetchPosts: fetchRedditPosts,
  analyzeText: hybridAnalyze,
  storeSignals,
})
  .then((result) => {
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
