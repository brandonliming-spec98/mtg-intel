import { extractSignalsFromText, type AnalysisInput } from "@/lib/claude-analysis";
import { ruleBasedAnalyze } from "@/lib/rule-based-analysis";
import type { IntelSignal } from "@/types";

export interface HybridAnalysisInput extends AnalysisInput {
  score?: number;
}

type ClaudeAnalyzer = (input: HybridAnalysisInput) => Promise<IntelSignal[]>;
type RuleAnalyzer = (input: HybridAnalysisInput) => Promise<IntelSignal[]>;

interface HybridDeps {
  claude?: ClaudeAnalyzer;
  ruleBased?: RuleAnalyzer;
}

function shouldRunClaude(input: HybridAnalysisInput): boolean {
  if (input.source_type === "youtube") return true;
  if (input.source_type === "reddit" && (input.score ?? 0) >= 100) return true;
  return false;
}

export async function hybridAnalyze(
  input: HybridAnalysisInput,
  deps: HybridDeps = {}
): Promise<IntelSignal[]> {
  const claudeFn = deps.claude ?? ((i) => extractSignalsFromText(i));
  const ruleFn = deps.ruleBased ?? ruleBasedAnalyze;

  let ruleResults: IntelSignal[] = [];
  let catalogFailed = false;

  try {
    ruleResults = await ruleFn(input);
  } catch {
    catalogFailed = true;
  }

  const claudeAvailable = !!(deps.claude || process.env.ANTHROPIC_API_KEY);

  if ((catalogFailed || shouldRunClaude(input)) && claudeAvailable) {
    return claudeFn(input);
  }

  return ruleResults;
}
