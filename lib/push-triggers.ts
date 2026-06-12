import type { SupabaseClient } from "@supabase/supabase-js";
import type { WatchlistEntry, CardPriceData } from "@/types";

export type TriggerType = "new_signal" | "price_spike" | "price_drop" | "ban_risk" | "hot_card";

export interface TriggerResult {
  entry: WatchlistEntry;
  trigger: TriggerType;
  title: string;
  body: string;
  url: string;
}

type Client = Pick<SupabaseClient, "from">;
type PriceFetcher = (name: string) => Promise<CardPriceData | null>;

const THRESHOLD_PCT = Number(process.env.PRICE_ALERT_THRESHOLD ?? "10");
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isDue(key: string, lastNotified: Record<string, string>): boolean {
  const last = lastNotified[key];
  if (!last) return true;
  return Date.now() - new Date(last).getTime() > COOLDOWN_MS;
}

export async function checkTriggers(
  watchlist: WatchlistEntry[],
  lastNotified: Record<string, string>,
  supabase: Client,
  fetchPrice: PriceFetcher
): Promise<TriggerResult[]> {
  if (watchlist.length === 0) return [];

  const results: TriggerResult[] = [];
  const cardNames = [...new Set(watchlist.map((e) => e.card_name))];
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // last hour

  // ── New signal ─────────────────────────────────────────────────────────────
  const { data: newSignals } = await supabase
    .from("intel_signals")
    .select("card_name_raw, sentiment, source_type")
    .in("card_name_raw", cardNames)
    .gte("ingested_at", since);

  for (const signal of newSignals ?? []) {
    const entry = watchlist.find((e) => e.card_name === signal.card_name_raw);
    if (!entry) continue;
    const key = `${entry.id}_new_signal`;
    if (!isDue(key, lastNotified)) continue;
    results.push({
      entry,
      trigger: "new_signal",
      title: `New signal: ${entry.card_name}`,
      body: `${signal.sentiment === "bullish" ? "▲" : signal.sentiment === "bearish" ? "▼" : "—"} ${signal.sentiment} · ${signal.source_type}`,
      url: `/search?q=${encodeURIComponent(entry.card_name)}`,
    });
  }

  // ── Ban risk spike ─────────────────────────────────────────────────────────
  const { data: highRisk } = await supabase
    .from("card_mechanics")
    .select("card_name, ban_risk, ban_risk_by_format")
    .gt("ban_risk", 0.75)
    .in("card_name", cardNames);

  for (const m of highRisk ?? []) {
    const entry = watchlist.find((e) => e.card_name === m.card_name);
    if (!entry) continue;
    const key = `${entry.id}_ban_risk`;
    if (!isDue(key, lastNotified)) continue;
    const topFormat = Object.entries(m.ban_risk_by_format ?? {})
      .sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0] ?? "unknown";
    results.push({
      entry,
      trigger: "ban_risk",
      title: `⚠ Ban risk: ${entry.card_name}`,
      body: `High ban risk in ${topFormat}`,
      url: `/search?q=${encodeURIComponent(entry.card_name)}`,
    });
  }

  // ── Hot card ───────────────────────────────────────────────────────────────
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: hotSignals } = await supabase
    .from("intel_signals")
    .select("card_name_raw")
    .in("card_name_raw", cardNames)
    .gte("ingested_at", since24h);

  const signalCounts = (hotSignals ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.card_name_raw] = (acc[s.card_name_raw] ?? 0) + 1;
    return acc;
  }, {});

  for (const entry of watchlist) {
    const count = signalCounts[entry.card_name] ?? 0;
    if (count < 3) continue;
    const key = `${entry.id}_hot_card`;
    if (!isDue(key, lastNotified)) continue;
    results.push({
      entry,
      trigger: "hot_card",
      title: `${entry.card_name} is trending`,
      body: `${count} signals in recent feed`,
      url: `/hot`,
    });
  }

  // ── Price spike / drop ─────────────────────────────────────────────────────
  await Promise.all(
    watchlist.map(async (entry) => {
      const priceData = await fetchPrice(entry.card_name);
      if (!priceData?.currentPrice || priceData.history.length < 2) return;

      const current = priceData.currentPrice;
      const prev = priceData.history[Math.max(0, priceData.history.length - 2)]?.price;
      if (!prev || prev === 0) return;

      const pct = ((current - prev) / prev) * 100;

      if (pct >= THRESHOLD_PCT) {
        const key = `${entry.id}_price_spike`;
        if (!isDue(key, lastNotified)) return;
        results.push({
          entry,
          trigger: "price_spike",
          title: `${entry.card_name} up ${pct.toFixed(1)}%`,
          body: `Now $${current.toFixed(2)}`,
          url: `/search?q=${encodeURIComponent(entry.card_name)}`,
        });
      } else if (pct <= -THRESHOLD_PCT) {
        const key = `${entry.id}_price_drop`;
        if (!isDue(key, lastNotified)) return;
        results.push({
          entry,
          trigger: "price_drop",
          title: `${entry.card_name} down ${Math.abs(pct).toFixed(1)}%`,
          body: `Now $${current.toFixed(2)}`,
          url: `/search?q=${encodeURIComponent(entry.card_name)}`,
        });
      }
    })
  );

  return results;
}
