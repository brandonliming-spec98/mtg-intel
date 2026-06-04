"use client";
import { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { PricePoint } from "@/types";
import { formatPrice } from "@/lib/price-sources";

interface Props {
  history: PricePoint[];
  currentPrice: number | null;
}

const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 },
  { label: "ALL", days: Infinity },
];

export default function PriceChart({ history, currentPrice }: Props) {
  const [range, setRange] = useState(90);

  const filtered = useMemo(() => {
    if (!history.length) return [];
    if (range === Infinity) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    return history.filter(p => p.date >= cutoffStr);
  }, [history, range]);

  const minPrice = Math.min(...filtered.map(p => p.price)) * 0.95;
  const maxPrice = Math.max(...filtered.map(p => p.price)) * 1.05;

  const first = filtered[0]?.price;
  const last = filtered[filtered.length - 1]?.price ?? currentPrice;
  const priceUp = last !== undefined && first !== undefined ? last >= first : true;
  const strokeColor = priceUp ? "#22c55e" : "#ef4444";

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-bg-elevated border border-bg-border rounded-lg px-3 py-2 text-sm shadow-xl">
        <div className="text-neutral font-mono text-xs mb-1">{label}</div>
        <div className="text-white font-mono font-bold">{formatPrice(payload[0].value)}</div>
      </div>
    );
  };

  if (!filtered.length) {
    return (
      <div className="h-40 flex items-center justify-center text-neutral text-sm">
        No price history available
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-4">
        {RANGES.map(r => (
          <button
            key={r.label}
            onClick={() => setRange(r.days)}
            className={`text-xs font-mono px-2.5 py-1 rounded-md transition-all ${
              range === r.days
                ? "bg-gold/20 text-gold border border-gold/30"
                : "text-neutral hover:text-white hover:bg-bg-elevated"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={filtered} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.2} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={d => {
              const [, m, day] = d.split("-");
              return `${m}/${day}`;
            }}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[minPrice, maxPrice]}
            tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v.toFixed(0)}`}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="price"
            stroke={strokeColor}
            strokeWidth={2}
            fill="url(#priceGrad)"
            dot={false}
            activeDot={{ r: 4, fill: strokeColor, stroke: "var(--bg-primary)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
