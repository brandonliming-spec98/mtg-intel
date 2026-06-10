import { Zap, AlertTriangle, TrendingUp } from "lucide-react";
import type { MechanicsProfile, FormatKey } from "@/types";

const FORMATS: Array<{ key: FormatKey; label: string }> = [
  { key: "standard",  label: "Std" },
  { key: "pioneer",   label: "Pio" },
  { key: "modern",    label: "Mod" },
  { key: "legacy",    label: "Leg" },
  { key: "commander", label: "Cmd" },
];

function breakScoreColor(score: number): string {
  if (score <= 4) return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10";
  if (score <= 6) return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
  if (score <= 8) return "text-orange-400 border-orange-400/30 bg-orange-400/10";
  return "text-red-400 border-red-400/30 bg-red-400/10";
}

function banRiskLabel(risk: number): { label: string; color: string } {
  if (risk < 0.2) return { label: "LOW",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" };
  if (risk < 0.4) return { label: "MEDIUM",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" };
  if (risk < 0.6) return { label: "HIGH",     color: "text-orange-400 bg-orange-400/10 border-orange-400/30" };
  return           { label: "CRITICAL", color: "text-red-400 bg-red-400/10 border-red-400/30" };
}

function topFormat(scores: MechanicsProfile["format_scores"]): string {
  const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const labels: Record<FormatKey, string> = {
    standard: "Standard", pioneer: "Pioneer", modern: "Modern",
    legacy: "Legacy", commander: "Commander",
  };
  return top ? labels[top[0] as FormatKey] ?? top[0] : "—";
}

export default function MechanicsPanel({ profile }: { profile: MechanicsProfile }) {
  const breakColor = breakScoreColor(profile.break_score);
  const { label: riskLabel, color: riskColor } = banRiskLabel(profile.ban_risk);
  const bestFormat = topFormat(profile.format_scores);

  return (
    <div className="bg-bg-card border border-bg-border rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs font-mono text-neutral uppercase tracking-wider">
        <Zap size={12} /> Mechanics Analysis
      </div>

      {/* Score chips */}
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border ${breakColor}`}>
          Break {profile.break_score.toFixed(1)}/10
        </span>
        <span className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl border ${riskColor}`}>
          Ban Risk {riskLabel}
        </span>
        <span className="text-xs font-mono px-3 py-1.5 rounded-xl border border-bg-border text-neutral">
          <TrendingUp size={10} className="inline mr-1" />Best in {bestFormat}
        </span>
      </div>

      {/* Mechanics tags */}
      {profile.mechanics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.mechanics.map((m) => (
            <span
              key={m}
              className="text-xs font-mono px-2 py-0.5 rounded-lg bg-bg-elevated border border-bg-border text-neutral capitalize"
            >
              {m.replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}

      {/* Format scores grid */}
      <div className="grid grid-cols-5 gap-2">
        {FORMATS.map(({ key, label }) => {
          const score = profile.format_scores[key];
          const pct = (score / 10) * 100;
          return (
            <div key={key} className="flex flex-col items-center gap-1">
              <div className="w-full h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                <div
                  className="h-full bg-gold rounded-full"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-mono text-neutral">{score.toFixed(0)}</span>
              <span className="text-[10px] font-mono text-neutral/60">{label}</span>
            </div>
          );
        })}
      </div>

      {/* Price ceiling warning */}
      {profile.price_ceiling_flag && (
        <div className="flex items-start gap-2 bg-orange-400/8 border border-orange-400/20 rounded-xl p-3">
          <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-xs font-bold text-orange-400 mb-0.5">Ban Risk Ceiling</div>
            <div className="text-xs text-neutral leading-relaxed">
              High break score limits upside. Ban probability caps long-term price appreciation.
            </div>
          </div>
        </div>
      )}

      {/* Ban reasoning (Claude-generated, high-break cards only) */}
      {profile.ban_reasoning && (
        <p className="text-xs text-neutral/70 italic leading-relaxed border-t border-bg-border pt-3">
          {profile.ban_reasoning}
        </p>
      )}
    </div>
  );
}
