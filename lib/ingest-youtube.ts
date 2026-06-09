import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { IntelSignal } from "@/types";

export interface YouTubeIngestResult {
  videosProcessed: number;
  signalsFound: number;
  errors: string[];
}

interface YouTubeIngestDeps {
  fetchVideos: () => Promise<HybridAnalysisInput[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
}

export async function runYouTubeIngestion(deps: YouTubeIngestDeps): Promise<YouTubeIngestResult> {
  const videos = await deps.fetchVideos();
  const allSignals: IntelSignal[] = [];
  const errors: string[] = [];

  for (const video of videos) {
    const videoId = video.source_url.split("v=")[1] ?? video.source_url;
    try {
      const signals = await deps.analyzeText(video);
      allSignals.push(...signals);
    } catch (err) {
      errors.push(`${videoId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (allSignals.length > 0) {
    await deps.storeSignals(allSignals);
  }

  return {
    videosProcessed: videos.length,
    signalsFound: allSignals.length,
    errors,
  };
}
