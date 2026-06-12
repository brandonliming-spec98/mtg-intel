import Anthropic from "@anthropic-ai/sdk";
import { IntelSignal } from "@/types";

export interface AnalysisInput {
  content: string;
  source_type: IntelSignal["source_type"];
  source_url: string;
  source_title: string;
  published_at: string;
}

type ClaudeClient = Pick<Anthropic, "messages">;

const SYSTEM_PROMPT = `You are an MTG finance analyst. Given content from a provided source, extract any Magic: The Gathering card mentions and classify each as:
- card_name: exact card name as mentioned
- sentiment: bullish | bearish | neutral
- signal_strength: 1-10
- reason: one sentence why
- excerpt: the specific quote/passage (max 100 words)

Return JSON only — an array of objects with those exact keys. If no cards are mentioned, return an empty array [].`;

function parseClaudeJson(text: string): unknown[] {
  const stripped = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    const parsed = JSON.parse(stripped);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function extractSignalsFromText(
  input: AnalysisInput,
  client?: ClaudeClient
): Promise<IntelSignal[]> {
  if (!client && !process.env.ANTHROPIC_API_KEY) return [];
  const resolvedClient = client ?? new Anthropic();

  const userMessage = `Source type: ${input.source_type}
Source: ${input.source_title}
URL: ${input.source_url}

Content:
${input.content}`;

  const response = await resolvedClient.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.find((b) => b.type === "text")?.text ?? "";
  const raw = parseClaudeJson(text);

  return raw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    )
    .map((item) => ({
      id: generateId(),
      card_name_raw: String(item.card_name ?? ""),
      source_type: input.source_type,
      source_url: input.source_url,
      source_title: input.source_title,
      sentiment: (item.sentiment as IntelSignal["sentiment"]) ?? "neutral",
      signal_strength: Number(item.signal_strength ?? 5),
      summary: String(item.reason ?? ""),
      published_at: input.published_at,
    }));
}
