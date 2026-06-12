import type { SignalPip } from "@/types";

const PIP_STYLE: Record<SignalPip, { bg: string; color: string; label: string }> = {
  sentiment: { bg: "radial-gradient(circle,#1a5c1a,#0d2e0d)", color: "#4ade80", label: "B" },
  signal:    { bg: "radial-gradient(circle,#1a3a5c,#0d1e3d)", color: "#60a5fa", label: "F" },
  price:     { bg: "radial-gradient(circle,#5c1a1a,#3d0d0d)", color: "#f87171", label: "P" },
  mechanics: { bg: "radial-gradient(circle,#3d2e00,#261e00)", color: "#fbbf24", label: "M" },
  generic:   { bg: "radial-gradient(circle,#2a2a2a,#1a1a1a)", color: "#9ca3af", label: "G" },
};

export default function ProjectionManaBar({ pips }: { pips: SignalPip[] }) {
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {pips.slice(0, 4).map((pip, i) => {
        const s = PIP_STYLE[pip];
        return (
          <div
            key={i}
            style={{
              width: 18, height: 18, borderRadius: "50%",
              background: s.bg,
              border: "1.5px solid #0a0a0a",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 7, fontWeight: 700, fontFamily: "monospace",
              color: s.color,
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
              flexShrink: 0,
            }}
          >
            {s.label}
          </div>
        );
      })}
    </div>
  );
}
