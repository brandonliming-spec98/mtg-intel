import { YoutubeTranscript } from "youtube-transcript";
import type { HybridAnalysisInput } from "@/lib/hybrid-analysis";

const CHANNELS = [
  { name: "Tolarian Community College", id: "UCBTbckqcj4JLxAXKNMzrtZQ" },
  { name: "The Mana Traders",           id: "UCpZCNYMXJI_ptSBD3t47NOQ" },
  { name: "Alpha Investments (Rudy)",   id: "UCmI_pLG0BVNTY5n-PiDVbig" },
  { name: "MTGGoldfish",                id: "UCZAzmjqpSncHs_Ci5PJo_Ig" },
  { name: "Strictly Better MTG",        id: "UCpREVHqGO8jGjnrSbQZBfJw" },
] as const;

interface RssEntry {
  videoId: string;
  title: string;
  published: string;
  channelName: string;
}

function parseRssEntries(xml: string, channelName: string): RssEntry[] {
  const entries: RssEntry[] = [];
  const entryPattern = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const block = match[1];
    const videoId = (block.match(/<yt:videoId>(.*?)<\/yt:videoId>/) ?? [])[1];
    const rawTitle = (block.match(/<title>(.*?)<\/title>/) ?? [])[1] ?? "";
    const title = rawTitle.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    const published = (block.match(/<published>(.*?)<\/published>/) ?? [])[1];

    if (videoId && title && published) {
      entries.push({ videoId, title, published, channelName });
    }
  }

  return entries;
}

export async function fetchYouTubeVideos(): Promise<HybridAnalysisInput[]> {
  const seen = new Set<string>();
  const results: HybridAnalysisInput[] = [];

  for (const channel of CHANNELS) {
    let xml: string;
    try {
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.id}`
      );
      if (!res.ok) continue;
      xml = await res.text();
    } catch {
      continue;
    }

    const entries = parseRssEntries(xml, channel.name);

    for (const entry of entries) {
      if (seen.has(entry.videoId)) continue;
      seen.add(entry.videoId);

      let transcript: string;
      try {
        const segments = await YoutubeTranscript.fetchTranscript(entry.videoId);
        transcript = segments.map((s) => s.text).join(" ");
      } catch {
        continue;
      }

      results.push({
        content: transcript,
        source_type: "youtube",
        source_url: `https://youtube.com/watch?v=${entry.videoId}`,
        source_title: `${entry.channelName}: ${entry.title}`,
        published_at: new Date(entry.published).toISOString(),
      });
    }
  }

  return results;
}
