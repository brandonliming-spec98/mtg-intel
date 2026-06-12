// Manual trigger for the Reddit ingestion pipeline (same flow as /api/ingest/reddit).
// Run: npx tsx scripts/run-reddit-ingest.ts   (loads .env.local itself)
import { readFileSync } from "node:fs";
import { join } from "node:path";

for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

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
