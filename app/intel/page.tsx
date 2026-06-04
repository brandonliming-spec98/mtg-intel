import Link from "next/link";
import { Zap, PlayCircle, MessageSquare, Newspaper, Clock } from "lucide-react";

const SOURCES = [
  { icon: PlayCircle, label: "Alpha Investments", desc: "YouTube · Finance & Speculation", color: "#ef4444", status: "Phase 2" },
  { icon: PlayCircle, label: "Tolarian Community College", desc: "YouTube · Set Reviews & Value", color: "#ef4444", status: "Phase 2" },
  { icon: MessageSquare, label: "r/mtgfinance", desc: "Reddit · Community Signals", color: "#ff6314", status: "Phase 2" },
  { icon: MessageSquare, label: "r/magicTCG", desc: "Reddit · Player Sentiment", color: "#ff6314", status: "Phase 2" },
  { icon: Newspaper, label: "MTGGoldfish Articles", desc: "News · Meta & Set Analysis", color: "#4a90d9", status: "Phase 2" },
  { icon: Newspaper, label: "EDHREC", desc: "News · Commander Demand", color: "#4a90d9", status: "Phase 2" },
];

export default function IntelPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 text-xs font-mono text-gold mb-6">
          <Clock size={12} />
          PHASE 2 — IN DEVELOPMENT
        </div>
        <h1 className="font-display text-4xl font-bold text-white mb-4">
          Intelligence Feed
        </h1>
        <p className="text-neutral text-lg max-w-lg mx-auto leading-relaxed">
          AI-powered analysis of YouTube commentary, Reddit posts, and MTG news — automatically surfacing what the community is bullish or bearish on.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-bg-card border border-bg-border rounded-2xl p-6 mb-8">
        <h2 className="font-display text-xl font-bold text-white mb-4">How the Intelligence Loop Works</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { step: "01", title: "Ingest", desc: "New YouTube videos and Reddit posts are pulled automatically every few hours" },
            { step: "02", title: "Analyze", desc: "Claude AI reads each piece of content and extracts card mentions, sentiment, and signals" },
            { step: "03", title: "Surface", desc: "Signals appear on card pages and in this feed — ranked by strength and recency" },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <span className="font-mono text-2xl font-bold text-gold/30">{s.step}</span>
              <div>
                <div className="font-bold text-white text-sm mb-1">{s.title}</div>
                <div className="text-neutral text-xs leading-relaxed">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sources grid */}
      <h2 className="font-mono text-xs text-neutral uppercase tracking-wider mb-4">
        Sources Being Integrated
      </h2>
      <div className="grid md:grid-cols-2 gap-3 mb-10">
        {SOURCES.map(({ icon: Icon, label, desc, color, status }) => (
          <div key={label} className="flex items-center gap-4 bg-bg-card border border-bg-border rounded-xl p-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30` }}
            >
              <Icon size={18} style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-sm">{label}</div>
              <div className="text-neutral text-xs">{desc}</div>
            </div>
            <span className="text-xs font-mono text-neutral bg-bg-elevated border border-bg-border rounded-full px-2 py-1 flex-shrink-0">
              {status}
            </span>
          </div>
        ))}
      </div>

      {/* CTA to Phase 1 */}
      <div className="bg-bg-elevated border border-bg-border rounded-2xl p-8 text-center">
        <Zap size={32} className="text-gold mx-auto mb-4" />
        <h3 className="font-display text-xl font-bold text-white mb-2">While you wait…</h3>
        <p className="text-neutral text-sm mb-6">
          Explore live card prices and today's market movers — available right now.
        </p>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/search"
            className="bg-gold text-bg-primary font-mono font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gold-light transition-colors"
          >
            Search Cards
          </Link>
          <Link
            href="/market"
            className="border border-bg-border text-white font-mono text-sm px-5 py-2.5 rounded-xl hover:border-gold/30 hover:text-gold transition-all"
          >
            Market Movers
          </Link>
        </div>
      </div>
    </div>
  );
}
