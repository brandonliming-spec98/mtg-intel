import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { MTGStocksInterest } from "@/types";
import { formatPrice } from "@/lib/price-sources";

interface Props {
  mover: MTGStocksInterest;
  rank: number;
}

export default function MoverCard({ mover, rank }: Props) {
  const isUp = mover.percent > 0;
  const changeColor = isUp ? "text-bull" : "text-bear";
  const bgColor = isUp ? "bg-bull/5 border-bull/20" : "bg-bear/5 border-bear/20";
  const Icon = isUp ? TrendingUp : TrendingDown;

  return (
    <Link href={`/search?q=${encodeURIComponent(mover.name)}`}>
      <div className={`flex items-center gap-3 p-3 rounded-xl border ${bgColor} hover:opacity-90 transition-all card-hover`}>
        <span className="text-lg font-mono font-bold text-neutral w-6 text-center flex-shrink-0">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-semibold text-white truncate">{mover.name}</div>
          {mover.set_name && (
            <div className="text-xs text-neutral font-mono truncate">{mover.set_name}</div>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <div className="font-mono text-sm font-bold text-white">{formatPrice(mover.new_price)}</div>
          <div className={`flex items-center gap-1 text-xs font-mono font-bold ${changeColor}`}>
            <Icon size={11} />
            {isUp ? "+" : ""}{mover.percent.toFixed(1)}%
          </div>
        </div>
      </div>
    </Link>
  );
}
