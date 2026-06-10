import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";
import type { IntelSignal, ScryfallCard, MechanicsProfile } from "@/types";

export interface YouTubeIngestResult {
  videosProcessed: number;
  signalsFound: number;
  errors: string[];
}

interface YouTubeIngestDeps {
  fetchVideos: () => Promise<HybridAnalysisInput[]>;
  analyzeText: (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
  storeSignals: (signals: IntelSignal[]) => Promise<void>;
  scoreMechanics?: (card: ScryfallCard) => Promise<MechanicsProfile>;
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

    const cardNames = [...new Set(allSignals.map((s) => s.card_name_raw).filter(Boolean) as string[])];
    if (cardNames.length > 0) {
      try {
        const { scoreNewCards } = await import(/* @vite-ignore */ ["@/lib/mechanics-profiles"].join(""));
        const scoreResult = await scoreNewCards(cardNames, {
          scoreMechanics: deps.scoreMechanics,
        });
        errors.push(...scoreResult.errors);
      } catch (err) {
        errors.push(`scoreNewCards failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return {
    videosProcessed: videos.length,
    signalsFound: allSignals.length,
    errors,
  };
}
