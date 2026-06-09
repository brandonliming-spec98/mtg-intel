import { getCardCatalog } from "@/lib/scryfall-catalog";
import type { AnalysisInput } from "@/lib/claude-analysis";
import type { IntelSignal } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function ruleBasedAnalyze(input: AnalysisInput): Promise<IntelSignal[]> {
  const catalog = await getCardCatalog();
  const lowerContent = input.content.toLowerCase();
  const seen = new Set<string>();
  const signals: IntelSignal[] = [];

  for (const name of catalog) {
    if (seen.has(name)) continue;
    const lowerName = name.toLowerCase();

    // Check if the full card name is in the content, or just the first word(s)
    if (lowerContent.includes(lowerName)) {
      seen.add(name);
      signals.push({
        id: generateId(),
        card_name_raw: name,
        source_type: input.source_type,
        source_url: input.source_url,
        source_title: input.source_title,
        sentiment: "neutral",
        signal_strength: 3,
        summary: "Card mentioned in source",
        published_at: input.published_at,
      });
    } else {
      // Check if the first part (before comma) matches
      const firstPart = lowerName.split(",")[0].trim();
      if (firstPart && lowerContent.includes(firstPart)) {
        // Verify it's a word boundary match (not part of another word)
        const regex = new RegExp(`\\b${firstPart}\\b`, "i");
        if (regex.test(input.content)) {
          seen.add(name);
          signals.push({
            id: generateId(),
            card_name_raw: name,
            source_type: input.source_type,
            source_url: input.source_url,
            source_title: input.source_title,
            sentiment: "neutral",
            signal_strength: 3,
            summary: "Card mentioned in source",
            published_at: input.published_at,
          });
        }
      }
    }
  }

  return signals;
}
