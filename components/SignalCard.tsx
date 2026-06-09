import Link from "next/link";
import type { IntelSignal } from "@/types";

interface Props {
  signal: IntelSignal;
  cardImageUrl?: string;
  /** Pre-formatted price string e.g. "$38.50" — omit to hide price column */
  priceDisplay?: string;
  /** Pre-formatted delta string e.g. "+12.3%" — shown next to price */
  priceDelta?: string;
  priceUp?: boolean;
  momentumScore?: number;
  /** Index in the rendered list (0-based) — drives stagger animation for first 6 */
  listIndex?: number;
}

const SOURCE_LABEL: Record<IntelSignal["source_type"], string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  news: "News",
  mtggoldfish: "MTGGoldfish",
};

export default function SignalCard({
  signal,
  cardImageUrl,
  priceDisplay,
  priceDelta,
  priceUp,
  momentumScore,
  listIndex = 6,
}: Props) {
  const isBull = signal.sentiment === "bullish";
  const isBear = signal.sentiment === "bearish";

  const borderColor = isBull
    ? "rgba(34,197,94,0.19)"
    : isBear
    ? "rgba(239,68,68,0.19)"
    : "rgba(42,42,58,1)";

  const barGradient = isBull
    ? "linear-gradient(to bottom, #22c55e, #6366f1)"
    : isBear
    ? "linear-gradient(to bottom, #ef4444, #6366f1)"
    : "linear-gradient(to bottom, #64748b, #6366f1)";

  const sentimentColor = isBull ? "#22c55e" : isBear ? "#ef4444" : "#64748b";
  const sentimentLabel = isBull ? "▲ BULLISH" : isBear ? "▼ BEARISH" : "— NEUTRAL";

  const staggerClass = listIndex < 6 ? "signal-stagger" : "";

  const timeAgo = (() => {
    const diff = Date.now() - new Date(signal.published_at).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${staggerClass}`}
      style={{ border: `1px solid ${borderColor}` }}
    >
      {/* Left gradient bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ background: barGradient }}
      />

      <div className="bg-bg-card p-4 pl-5 flex gap-3 items-start">
        {/* Card art thumbnail */}
        <div
          className="card-art-thumb flex-shrink-0 rounded-[4px] flex items-center justify-center text-lg overflow-hidden"
          style={{
            width: 40,
            height: 56,
            border: "1px solid rgba(212,175,55,0.31)",
            background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
          }}
        >
          {cardImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cardImageUrl}
              alt={signal.card_name_raw}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span>🃏</span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/search?q=${encodeURIComponent(signal.card_name_raw)}`}
                className="font-chakra font-bold text-gold hover:text-gold-light transition-colors text-[13px] leading-tight block truncate"
              >
                {signal.card_name_raw}
              </Link>
              <div className="text-neutral text-[10px] font-mono mt-0.5">
                {SOURCE_LABEL[signal.source_type]} · {timeAgo} · score {signal.signal_strength}/10
              </div>
            </div>
            {priceDisplay && (
              <div className="text-right flex-shrink-0">
                <div className="text-white font-mono font-bold text-[13px]">{priceDisplay}</div>
                {priceDelta && (
                  <div
                    className="text-[10px] font-mono"
                    style={{ color: priceUp ? "#22c55e" : "#ef4444" }}
                  >
                    {priceDelta}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quote */}
          <p className="text-neutral text-xs font-mono mt-1.5 leading-relaxed line-clamp-2">
            &ldquo;{signal.summary}&rdquo;
          </p>

          {/* Badges */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span
              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border"
              style={{
                color: sentimentColor,
                background: `${sentimentColor}18`,
                borderColor: `${sentimentColor}40`,
              }}
            >
              {sentimentLabel}
            </span>
            {momentumScore !== undefined && (
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded-full border"
                style={{
                  color: "#a855f7",
                  background: "#a855f718",
                  borderColor: "#a855f740",
                }}
              >
                ◆ {momentumScore} momentum
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
