import { rarityColor } from "@/lib/scryfall";

interface Props { rarity: string; className?: string }

export default function RarityBadge({ rarity, className = "" }: Props) {
  const color = rarityColor(rarity);
  return (
    <span
      className={`text-xs font-mono font-medium uppercase tracking-wider px-2 py-0.5 rounded border ${className}`}
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}12` }}
    >
      {rarity}
    </span>
  );
}
