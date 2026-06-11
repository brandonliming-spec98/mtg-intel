import { createClient } from "@supabase/supabase-js";
import { scoreNewCards } from "@/lib/mechanics-profiles";

interface BulkPrescoreDeps {
  fetchCardNames: () => Promise<string[]>;
  scoreCards: (names: string[]) => Promise<{ scored: number; errors: string[] }>;
}

export interface BulkPrescoreResult {
  total: number;
  scored: number;
  errors: string[];
}

export async function runBulkPrescore(deps: BulkPrescoreDeps): Promise<BulkPrescoreResult> {
  let names: string[];
  try {
    names = await deps.fetchCardNames();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { total: 0, scored: 0, errors: [msg] };
  }

  if (names.length === 0) {
    return { total: 0, scored: 0, errors: [] };
  }

  const { scored, errors } = await deps.scoreCards(names);
  return { total: names.length, scored, errors };
}

// ── CLI entry point ───────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const start = Date.now();
  console.log("Fetching card names from intel_signals…");

  const result = await runBulkPrescore({
    async fetchCardNames() {
      const { data, error } = await supabase
        .from("intel_signals")
        .select("card_name_raw")
        .not("card_name_raw", "is", null);
      if (error) throw new Error(error.message);
      const names = [...new Set((data ?? []).map((r) => r.card_name_raw as string).filter(Boolean))];
      console.log(`Found ${names.length} unique card names.`);
      return names;
    },
    scoreCards: (names) => scoreNewCards(names),
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s`);
  console.log(`  Total:  ${result.total}`);
  console.log(`  Scored: ${result.scored}`);
  if (result.errors.length > 0) {
    console.log(`  Errors (${result.errors.length}):`);
    result.errors.forEach((e) => console.log(`    - ${e}`));
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
