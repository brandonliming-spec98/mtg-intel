import type {
  ProjectionAlgorithm,
  ProjectionAlgorithmDef,
  AlgorithmCondition,
  CardFeatures,
  ProjectionVerdict,
} from "@/types";

type FeatureValue = number | string;

function evalCondition(cond: AlgorithmCondition, value: FeatureValue): boolean {
  const { op, val } = cond;
  if (typeof value === "number" && typeof val === "number") {
    if (op === "gt")  return value > val;
    if (op === "gte") return value >= val;
    if (op === "lt")  return value < val;
    if (op === "lte") return value <= val;
    if (op === "eq")  return value === val;
    if (op === "neq") return value !== val;
  }
  if (typeof value === "string" && typeof val === "string") {
    if (op === "eq")  return value === val;
    if (op === "neq") return value !== val;
  }
  return false;
}

export function evaluateAlgorithm(
  def: ProjectionAlgorithmDef,
  features: CardFeatures
): boolean {
  const map = features as unknown as Record<string, FeatureValue>;
  return def.conditions.every((c) => {
    const value = map[c.field];
    return value !== undefined && evalCondition(c, value);
  });
}

export function runAlgorithms(
  algorithms: ProjectionAlgorithm[],
  features: CardFeatures
): { verdict: ProjectionVerdict; confidence: number; purpose_key: string } | null {
  const matches = algorithms
    .filter((a) => a.promoted && evaluateAlgorithm(a.algorithm_json, features))
    .map((a) => ({
      verdict: a.algorithm_json.verdict,
      confidence: a.algorithm_json.confidence,
      purpose_key: a.purpose_key,
    }));

  if (matches.length < 2) return null;
  const allAgree = matches.every((m) => m.verdict === matches[0].verdict);
  if (!allAgree) return null;

  const meanConfidence =
    matches.reduce((sum, m) => sum + m.confidence, 0) / matches.length;
  return { verdict: matches[0].verdict, confidence: meanConfidence, purpose_key: matches[0].purpose_key };
}
