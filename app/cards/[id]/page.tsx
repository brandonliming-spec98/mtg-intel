import { getCardById, getCardRulings, getCardPrints, rarityColor } from "@/lib/scryfall";
import { getPriceWithFallback, formatPrice, getPriceChangeLabel } from "@/lib/price-sources";
import { fetchSignals } from "@/lib/supabase-signals";
import CardImage from "@/components/CardImage";
import PriceChart from "@/components/PriceChart";
import RarityBadge from "@/components/RarityBadge";
import Link from "next/link";
import { ExternalLink, BookOpen, TrendingUp, Layers, AlertCircle } from "lucide-react";
import CardHero from "@/components/CardHero";
import SignalCard from "@/components/SignalCard";
import MechanicsPanel from "@/components/MechanicsPanel";
import { getMechanicsProfile } from "@/lib/mechanics-profiles";
import { computeMomentum } from "@/lib/chart-utils";
import { notFound } from "next/navigation";
import type { IntelSignal, MechanicsProfile } from "@/types";

interface Props { params: Promise<{ id: string }> }

function ManaCost({ cost }: { cost: string }) {
  const symbols = (cost || "").replace(/\{([^}]+)\}/g, "$1|").split("|").filter(Boolean);
  const colors: Record<string, string> = {
    W: "#f9f0d4", U: "#4a90d9", B: "#9b59b6", R: "#e74c3c", G: "#27ae60",
    C: "#b0c4d8",
  };
  return (
    <div className="flex gap-1 flex-wrap">
      {symbols.map((s, i) => {
        const color = colors[s] ?? "#94a3b8";
        const isNum = /^\d+$/.test(s) || s === "X";
        return (
          <span
            key={i}
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold border text-bg-primary flex-shrink-0"
            style={{ background: isNum ? "#6b7280" : color, borderColor: `${isNum ? "#6b7280" : color}80` }}
          >
            {s}
          </span>
        );
      })}
    </div>
  );
}

export default async function CardDetailPage({ params }: Props) {
  const { id } = await params;

  let card, rulings, prints, priceData;
  try {
    [card, rulings, prints] = await Promise.all([
      getCardById(id),
      getCardRulings(id),
      getCardPrints(""),
    ]);
    priceData = await getPriceWithFallback(card.name);
  } catch {
    notFound();
  }

  let signals: IntelSignal[] = [];
  let mechanics: MechanicsProfile | null = null;
  try {
    [signals, mechanics] = await Promise.all([
      fetchSignals({ cardName: card.name, limit: 10 }).catch(() => []),
      getMechanicsProfile(id).catch(() => null),
    ]);
  } catch {
    // Supabase not configured yet — silently skip
  }

  const scryfallPrice = card.prices?.usd ? parseFloat(card.prices.usd) : null;
  const displayPrice = priceData?.currentPrice ?? scryfallPrice;
  const rColor = rarityColor(card.rarity);

  // Price change (last 7 days from history)
  const history = priceData?.history ?? [];
  const weekAgoPrice = history.length > 7 ? history[history.length - 8]?.price : null;
  const priceChange = weekAgoPrice && displayPrice
    ? getPriceChangeLabel(weekAgoPrice, displayPrice)
    : null;
  const priceUp = priceChange?.startsWith("+") ?? null;

  const bullish = signals.filter((s) => s.sentiment === "bullish");
  const bearish = signals.filter((s) => s.sentiment === "bearish");

  const now = Date.now();
  const signals24h = signals.filter(
    (s) => now - new Date(s.published_at).getTime() < 86400000
  ).length;
  const avgStrength =
    signals.length > 0
      ? signals.reduce((acc, s) => acc + s.signal_strength, 0) / signals.length
      : 0;
  const priceDeltaPct =
    weekAgoPrice && displayPrice && weekAgoPrice > 0
      ? ((displayPrice - weekAgoPrice) / weekAgoPrice) * 100
      : 0;
  const momentumScore = computeMomentum(signals.length, avgStrength, priceDeltaPct);

  const cardImageUrl =
    card.image_uris?.normal ?? card.card_faces?.[0]?.image_uris?.normal;

  const legalFormats = Object.entries(card.legalities)
    .filter(([, v]) => v === "legal")
    .map(([f]) => f.charAt(0).toUpperCase() + f.slice(1));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs font-mono text-neutral mb-6">
        <Link href="/" className="hover:text-gold transition-colors">Home</Link>
        <span>/</span>
        <Link href="/search" className="hover:text-gold transition-colors">Search</Link>
        <span>/</span>
        <span className="text-white">{card.name}</span>
      </nav>

      <div className="grid md:grid-cols-[320px,1fr] gap-8">
        {/* Left: Card image + quick stats */}
        <div className="space-y-4">
          <CardImage card={card} size="large" showBack className="w-full max-w-[320px] mx-auto" />

          {/* Price + momentum */}
          <CardHero
            name={card.name}
            formats={legalFormats}
            price={displayPrice}
            priceChange={priceChange}
            priceUp={priceUp}
            sentiment={
              signals.length === 0
                ? null
                : bullish.length > bearish.length
                ? "bullish"
                : bearish.length > bullish.length
                ? "bearish"
                : "neutral"
            }
            momentumScore={momentumScore}
            signalCount7d={signals.length}
            signalCount24h={signals24h}
          />
          {history.length > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
              <PriceChart history={history} currentPrice={displayPrice} />
            </div>
          )}

          {/* External links */}
          <div className="flex gap-2">
            <a
              href={card.scryfall_uri}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 text-xs font-mono text-neutral hover:text-gold border border-bg-border hover:border-gold/30 rounded-xl py-2.5 transition-all"
            >
              <ExternalLink size={12} /> Scryfall
            </a>
            <a
              href={`https://www.mtgstocks.com/cards/search/${encodeURIComponent(card.name)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 text-xs font-mono text-neutral hover:text-gold border border-bg-border hover:border-gold/30 rounded-xl py-2.5 transition-all"
            >
              <TrendingUp size={12} /> MTGStocks
            </a>
          </div>
        </div>

        {/* Right: Details */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight">
                {card.name}
              </h1>
              {card.mana_cost && <ManaCost cost={card.mana_cost} />}
            </div>
            <div className="flex items-center flex-wrap gap-3 mt-2">
              <RarityBadge rarity={card.rarity} />
              <span className="text-sm text-neutral font-mono">{card.set_name}</span>
              <span className="text-sm text-neutral font-mono">#{card.collector_number}</span>
              <span className="text-sm text-neutral">{card.type_line}</span>
            </div>
          </div>

          {/* Oracle text */}
          {card.oracle_text && (
            <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral uppercase tracking-wider mb-3">
                <BookOpen size={12} /> Oracle Text
              </div>
              <p className="text-white text-sm leading-relaxed whitespace-pre-line font-sans">
                {card.oracle_text}
              </p>
              {(card.power || card.loyalty) && (
                <div className="mt-3 pt-3 border-t border-bg-border text-right">
                  {card.power && (
                    <span className="font-display text-lg font-bold text-white">
                      {card.power}/{card.toughness}
                    </span>
                  )}
                  {card.loyalty && (
                    <span className="font-display text-lg font-bold text-gold">[{card.loyalty}]</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Mechanics panel */}
          {mechanics && <MechanicsPanel profile={mechanics} />}

          {/* Legality */}
          {legalFormats.length > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral uppercase tracking-wider mb-3">
                <Layers size={12} /> Legal In
              </div>
              <div className="flex flex-wrap gap-2">
                {legalFormats.map(f => (
                  <span key={f} className="text-xs font-mono px-2.5 py-1 bg-bg-elevated border border-bg-border rounded-lg text-white capitalize">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Rulings */}
          {rulings.length > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral uppercase tracking-wider mb-4">
                <AlertCircle size={12} /> Rulings
              </div>
              <div className="space-y-3">
                {rulings.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-sm border-l-2 border-bg-border pl-3">
                    <div className="text-xs font-mono text-neutral mb-1">{r.published_at}</div>
                    <div className="text-white leading-relaxed">{r.comment}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reserved List notice */}
          {card.reserved && (
            <div className="flex items-start gap-3 bg-gold/8 border border-gold/20 rounded-xl p-4">
              <AlertCircle size={16} className="text-gold flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-gold mb-1">Reserved List</div>
                <div className="text-xs text-neutral leading-relaxed">
                  This card is on the Magic: The Gathering Reserved List — Wizards of the Coast has committed to never reprint it. This significantly impacts long-term price floor.
                </div>
              </div>
            </div>
          )}

          {/* Intel signals */}
          {signals.length > 0 && (
            <div className="bg-bg-card border border-bg-border rounded-2xl p-5">
              <div className="flex items-center gap-2 text-xs font-mono text-neutral uppercase tracking-wider mb-4">
                <span>◆</span> What People Are Saying
              </div>
              <div className="flex flex-col gap-3">
                {signals.map((signal, i) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    cardImageUrl={cardImageUrl}
                    momentumScore={Math.min(100, signal.signal_strength * 10)}
                    listIndex={i}
                  />
                ))}
              </div>
              <a
                href="/intel"
                className="block text-center text-xs font-mono text-gold/60 hover:text-gold mt-4 transition-colors"
              >
                View all signals →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
