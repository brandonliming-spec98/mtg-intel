interface Props {
  score: number;
}

export default function ScoreRing({ score }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div
      aria-label={`Score ${clamped}`}
      style={{
        width: 56,
        height: 56,
        borderRadius: "50%",
        background: `conic-gradient(#a855f7 0% ${clamped}%, #21262d ${clamped}% 100%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "#0d1117",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "#a855f7",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "monospace",
          }}
        >
          {clamped}
        </span>
      </div>
    </div>
  );
}
