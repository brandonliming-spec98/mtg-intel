import MomentumBar from "./MomentumBar";

const VELOCITY_DISPLAY: Record<string, string> = {
  high:   "↑↑↑",
  medium: "↑↑",
  low:    "↑",
  none:   "—",
};

function velocityBand(signalCount24h: number): string {
  if (signalCount24h >= 3) return "high";
  if (signalCount24h >= 1) return "medium";
  return "none";
}

interface Props {
  name: string;
  /** Formatted legal format names e.g. ["Modern", "Pioneer"] */
  formats: string[];
  price: number | null;
  /** Formatted delta string e.g. "+12.3%" */
  priceChange: string | null;
  priceUp: boolean | null;
  sentiment: "bullish" | "bearish" | "neutral" | null;
  momentumScore: number;
  signalCount7d: number;
  /** Signals published in the last 24 hours */
  signalCount24h: number;
  /** Optional thumbnail — omit on card detail page (art already shown as hero) */
  cardImageUrl?: string;
}

export default function CardHero({
  name, formats, price, priceChange, priceUp,
  sentiment, momentumScore, signalCount7d, signalCount24h,
  cardImageUrl,
}: Props) {
  const isBull = sentiment === "bullish";
  const isBear = sentiment === "bearish";
  const sentimentColor = isBull ? "#22c55e" : isBear ? "#ef4444" : "#64748b";

  const velBand = velocityBand(signalCount24h);
  const velDisplay = VELOCITY_DISPLAY[velBand];
  const velColor = velBand === "high" ? "#ec4899" : velBand === "medium" ? "#a855f7" : "#64748b";

  return (
    <div
      className="bg-bg-card rounded-2xl overflow-hidden"
      style={{ border: "1px solid #2a2a3a" }}
    >
      {/* Rainbow accent bar */}
      <div style={{ height: 2, background: "var(--rainbow-bar)" }} />

      <div className="p-5">
        {/* Top row: optional art + name/badges + price */}
        <div className="flex gap-3 items-start mb-4">
          {cardImageUrl && (
            <div
              className="card-art-thumb flex-shrink-0 rounded-[5px] overflow-hidden"
              style={{
                width: 62, height: 87,
                border: "1.5px solid rgba(212,175,55,0.38)",
                background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
                boxShadow: "0 0 20px rgba(168,85,247,0.31)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardImageUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h2 className="font-chakra font-bold text-gold text-[17px] leading-tight mb-1">{name}</h2>
            <p className="text-neutral text-[11px] font-mono mb-2">
              {formats.slice(0, 4).join(" · ")}
            </p>

            {/* Signal badges */}
            <div className="flex flex-wrap gap-1.5">
              {(isBull || isBear) && (
                <span
                  className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                  style={{ color: sentimentColor, background: `${sentimentColor}18`, borderColor: `${sentimentColor}40` }}
                >
                  {isBull ? "▲ BUY SIGNAL" : "▼ SELL SIGNAL"}
                </span>
              )}
              {momentumScore >= 70 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                  style={{ color: "#a855f7", background: "#a855f718", borderColor: "#a855f740" }}>
                  ◆ HOT
                </span>
              )}
              {signalCount24h >= 3 && (
                <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                  style={{ color: "#ec4899", background: "#ec489918", borderColor: "#ec489940" }}>
                  ⚡ TRENDING
                </span>
              )}
            </div>
          </div>

          {/* Price */}
          <div className="text-right flex-shrink-0 ml-2">
            <div className="font-mono text-[22px] font-bold text-white leading-none">
              {price !== null ? `$${price.toFixed(2)}` : "—"}
            </div>
            {priceChange && (
              <div
                className="text-[12px] font-mono mt-1"
                style={{ color: priceUp ? "#22c55e" : "#ef4444" }}
              >
                {priceUp ? "▲" : "▼"} {priceChange} 7d
              </div>
            )}
          </div>
        </div>

        {/* Momentum bar */}
        <div className="mb-4">
          <MomentumBar score={momentumScore} />
        </div>

        {/* Metric pills */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Signals (7d)", value: signalCount7d, color: "#a855f7" },
            { label: "Sentiment",    value: isBull ? "BULL" : isBear ? "BEAR" : "FLAT", color: sentimentColor },
            { label: "Velocity",     value: velDisplay, color: velColor },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-lg p-2 text-center"
              style={{ background: "#0d0d1a", border: "1px solid #1a1a2e" }}
            >
              <div className="text-[9px] font-mono text-neutral uppercase tracking-[0.05em] mb-1">{label}</div>
              <div className="font-mono font-bold text-[15px]" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
