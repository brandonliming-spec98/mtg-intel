import Link from "next/link";
import SearchBar from "@/components/SearchBar";
import { TrendingUp, Zap, Search, ChevronRight } from "lucide-react";

const FEATURED_SEARCHES = [
  "Black Lotus", "Lightning Bolt", "Snapcaster Mage",
  "Force of Will", "Mox Pearl", "Ragavan",
];

const FEATURES = [
  {
    icon: Search,
    title: "Card Explorer",
    desc: "Search 30,000+ cards with live prices from MTGStocks",
    href: "/search",
    color: "#4a90d9",
  },
  {
    icon: TrendingUp,
    title: "Market Movers",
    desc: "Daily gainers and losers — see what's moving and why",
    href: "/market",
    color: "#d4a843",
  },
  {
    icon: Zap,
    title: "Intel Feed",
    desc: "YouTube + Reddit signals analyzed by AI — coming in Phase 2",
    href: "/intel",
    color: "#9b59b6",
    soon: true,
  },
];

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="relative px-5 md:px-8 pt-16 pb-12 md:pt-24 md:pb-16 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gold/6 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-gold/10 border border-gold/20 rounded-full px-4 py-1.5 text-xs font-mono text-gold mb-6">
            <span className="w-1.5 h-1.5 bg-bull rounded-full animate-pulse-gold" />
            LIVE MARKET DATA
          </div>

          <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
            MTG Finance<br />
            <span className="text-transparent bg-clip-text bg-gold-shimmer">Intelligence</span>
          </h1>

          <p className="text-neutral text-lg md:text-xl max-w-xl mx-auto mb-10 leading-relaxed">
            Real-time card prices, market signals, and AI-powered insights from across the MTG universe.
          </p>

          {/* Search */}
          <div className="flex justify-center mb-4">
            <SearchBar large />
          </div>

          {/* Quick searches */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {FEATURED_SEARCHES.map(name => (
              <Link
                key={name}
                href={`/search?q=${encodeURIComponent(name)}`}
                className="text-xs font-mono text-neutral hover:text-gold-light bg-bg-elevated hover:bg-gold/10 border border-bg-border hover:border-gold/30 rounded-full px-3 py-1.5 transition-all"
              >
                {name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-5 md:px-8 pb-16 max-w-5xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc, href, color, soon }) => (
            <Link key={href} href={href} className={soon ? "pointer-events-none" : ""}>
              <div className="relative bg-bg-card border border-bg-border rounded-2xl p-6 h-full card-hover group overflow-hidden">
                {/* Glow */}
                <div
                  className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `${color}20` }}
                />

                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                  style={{ background: `${color}15`, borderColor: `${color}30` }}
                >
                  <Icon size={20} style={{ color }} />
                </div>

                <h3 className="font-display text-lg font-bold text-white mb-2">
                  {title}
                  {soon && (
                    <span className="ml-2 text-xs font-mono font-normal text-neutral bg-bg-elevated border border-bg-border rounded-full px-2 py-0.5">
                      Soon
                    </span>
                  )}
                </h3>
                <p className="text-neutral text-sm leading-relaxed">{desc}</p>

                {!soon && (
                  <div className="flex items-center gap-1 mt-4 text-xs font-mono" style={{ color }}>
                    Explore <ChevronRight size={12} />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Casual user CTA */}
      <section className="px-5 md:px-8 pb-20 max-w-5xl mx-auto">
        <div className="bg-bg-card border border-bg-border rounded-2xl p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-white mb-3">
            Are your cards worth selling?
          </h2>
          <p className="text-neutral mb-6 max-w-md mx-auto">
            Search any card to see its current market value, price history, and what the community is saying about it.
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 bg-gold text-bg-primary font-mono font-bold text-sm px-6 py-3 rounded-xl hover:bg-gold-light transition-colors"
          >
            <Search size={16} />
            Check your cards
          </Link>
        </div>
      </section>
    </div>
  );
}
