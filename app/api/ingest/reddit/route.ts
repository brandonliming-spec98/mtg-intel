import { NextRequest, NextResponse } from "next/server";
import { runRedditIngestion } from "@/lib/ingest-reddit";
import { fetchRedditPosts } from "@/lib/reddit-ingest";
import { hybridAnalyze } from "@/lib/hybrid-analysis";
import { storeSignals } from "@/lib/supabase-signals";

function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get("x-ingest-secret");
  const bearer = req.headers.get("authorization");
  const expected = process.env.INGEST_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!expected) return true;
  if (secret === expected) return true;
  if (cronSecret && bearer === `Bearer ${cronSecret}`) return true;
  return false;
}

async function ingest() {
  return runRedditIngestion({
    fetchPosts: fetchRedditPosts,
    analyzeText: hybridAnalyze,
    storeSignals,
  });
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await ingest();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
