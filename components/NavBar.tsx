"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, TrendingUp, Zap, Home, Flame, Bookmark } from "lucide-react";

const links = [
  { href: "/",          label: "Home",      icon: Home },
  { href: "/search",    label: "Search",    icon: Search },
  { href: "/market",    label: "Market",    icon: TrendingUp },
  { href: "/hot",       label: "Hot Cards", icon: Flame },
  { href: "/watchlist", label: "Watchlist", icon: Bookmark },
  { href: "/intel",     label: "Intel",     icon: Zap, badge: "Soon" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center justify-between px-8 py-4 border-b border-bg-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-lg bg-gold/20 border border-gold/40 flex items-center justify-center">
            <span className="text-gold font-display font-bold text-sm">M</span>
          </div>
          <span className="font-display text-xl font-bold text-gold-light tracking-tight">
            MTG Intel
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
                  active
                    ? "bg-gold/15 text-gold-light border border-gold/20"
                    : "text-neutral hover:text-white hover:bg-bg-elevated"
                }`}
              >
                <Icon size={15} />
                {label}
                {badge && (
                  <span className="text-xs bg-bg-elevated border border-bg-border text-neutral px-1.5 py-0.5 rounded-full ml-1">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="text-xs text-neutral font-mono opacity-50">
          MTG FINANCE INTELLIGENCE
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-bg-border bg-bg-secondary/95 backdrop-blur-md">
        <div className="flex items-center justify-around py-2 px-2">
          {links.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-all ${
                  active ? "text-gold-light" : "text-neutral"
                }`}
              >
                <div className={`p-1.5 rounded-lg ${active ? "bg-gold/15" : ""}`}>
                  <Icon size={18} />
                </div>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Mobile top brand bar */}
      <div className="md:hidden flex items-center justify-between px-5 py-3 border-b border-bg-border bg-bg-secondary/80 backdrop-blur-md sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gold/20 border border-gold/40 flex items-center justify-center">
            <span className="text-gold font-display font-bold text-xs">M</span>
          </div>
          <span className="font-display text-lg font-bold text-gold-light">MTG Intel</span>
        </Link>
        <Link href="/search">
          <Search size={20} className="text-neutral" />
        </Link>
      </div>
    </>
  );
}
