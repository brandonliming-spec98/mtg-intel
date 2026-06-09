interface Props {
  score: number; // 0–100
}

export default function MomentumBar({ score }: Props) {
  const clamped = Math.min(100, Math.max(0, score));
  return (
    <div className="flex items-center gap-2">
      <span className="text-neutral text-[10px] font-mono uppercase tracking-[0.05em] flex-shrink-0">
        Momentum
      </span>
      <div
        className="flex-1 max-w-[130px] h-[5px] rounded-full overflow-hidden"
        style={{ background: "#1a1a2e" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${clamped}%`,
            background: "linear-gradient(90deg, #6366f1, #a855f7, #ec4899)",
          }}
        />
      </div>
      <span
        className="text-[13px] font-mono font-bold flex-shrink-0"
        style={{ color: "#a855f7" }}
      >
        {clamped}
      </span>
    </div>
  );
}
