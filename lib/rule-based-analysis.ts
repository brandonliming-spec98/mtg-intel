import { getCardCatalog } from "@/lib/scryfall-catalog";
import type { AnalysisInput } from "@/lib/claude-analysis";
import type { IntelSignal, SignalType } from "@/types";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Date extraction ───────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, nov: 11, dec: 12,
};

function extractSellWindow(content: string): string | null {
  const match = content.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i
  );
  if (!match) return null;
  const month = MONTH_MAP[match[1].toLowerCase()];
  const day = parseInt(match[2]);
  const year = match[3] ? parseInt(match[3]) : new Date().getFullYear();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ── Signal classification ─────────────────────────────────────────────────────

interface Classification {
  signal_type: SignalType;
  sentiment: "bullish" | "bearish" | "neutral";
  signal_strength: number;
  sell_window: string | null;
  summary: string;
}

const REPRINT_RE =
  /\b(reprint(?:ed|ing)?|secret\s+lair|commander\s+precon|double\s+masters|universes\s+beyond|masters\s+set|reprinted\s+in)\b/i;

const PRICE_PEAK_RE =
  /\b(peaked?|sell\s+(now|into|the|before)|great\s+time\s+to\s+sell|good\s+time\s+to\s+sell|time\s+to\s+sell|overpriced)\b/i;

const SET_PRESSURE_RE =
  /\b(new\s+set|set\s+dropping|releasing\s+soon|prices?\s+(will|should|might)\s+(fall|drop|crash)|price\s+drop|will\s+crash)\b/i;

const BUY_HYPE_RE =
  /\b(spiking?|buying|buy\s+copies|going\s+up|mooning|targets?|pick(?:ing)?\s+up|underpriced|undervalued|buyout|bought\s+out|price\s+increase)\b/i;

const FORMAT_STAPLE_RE =
  /\b(staple|every\s+deck|edh\s+staple|commander\s+staple|auto.include|must.have|format.defining|tier\s+1)\b/i;

function classify(content: string): Classification {
  // Sell signals — checked first (more specific / actionable)
  if (REPRINT_RE.test(content)) {
    return {
      signal_type: "reprint_announced",
      sentiment: "bearish",
      signal_strength: 7,
      sell_window: extractSellWindow(content),
      summary: "Reprint announced — price decline expected",
    };
  }
  if (PRICE_PEAK_RE.test(content)) {
    return {
      signal_type: "price_peak",
      sentiment: "bearish",
      signal_strength: 6,
      sell_window: null,
      summary: "Card may have peaked — community signaling sell",
    };
  }
  if (SET_PRESSURE_RE.test(content)) {
    return {
      signal_type: "set_release_pressure",
      sentiment: "bearish",
      signal_strength: 5,
      sell_window: extractSellWindow(content),
      summary: "Upcoming set release creating sell pressure",
    };
  }

  // Buy signals
  if (BUY_HYPE_RE.test(content)) {
    return {
      signal_type: "buy_hype",
      sentiment: "bullish",
      signal_strength: 6,
      sell_window: null,
      summary: "Card spiking — buy interest detected",
    };
  }
  if (FORMAT_STAPLE_RE.test(content)) {
    return {
      signal_type: "format_staple",
      sentiment: "bullish",
      signal_strength: 5,
      sell_window: null,
      summary: "Identified as format staple",
    };
  }

  return {
    signal_type: "general",
    sentiment: "neutral",
    signal_strength: 3,
    sell_window: null,
    summary: "Card mentioned in source",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function ruleBasedAnalyze(input: AnalysisInput): Promise<IntelSignal[]> {
  const catalog = await getCardCatalog();
  const lowerContent = input.content.toLowerCase();
  const seen = new Set<string>();
  const signals: IntelSignal[] = [];

  const { signal_type, sentiment, signal_strength, sell_window, summary } =
    classify(input.content);

  for (const name of catalog) {
    if (seen.has(name)) continue;
    if (lowerContent.includes(name.toLowerCase())) {
      seen.add(name);
      signals.push({
        id: generateId(),
        card_name_raw: name,
        source_type: input.source_type,
        source_url: input.source_url,
        source_title: input.source_title,
        sentiment,
        signal_type,
        sell_window,
        signal_strength,
        summary,
        published_at: input.published_at,
      });
    }
  }

  return signals;
}
