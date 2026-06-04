"use client";
import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import SearchBar from "@/components/SearchBar";
import CardGrid from "@/components/CardGrid";
import { ScryfallCard } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";

const FILTERS = [
  { label: "All", q: "" },
  { label: "Rare", q: "r:rare" },
  { label: "Mythic", q: "r:mythic" },
  { label: "Commander", q: "f:commander" },
  { label: "Standard", q: "f:standard" },
  { label: "Modern", q: "f:modern" },
  { label: "Legacy", q: "f:legacy" },
];

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [filter, setFilter] = useState("");
  const [cards, setCards] = useState<ScryfallCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCards, setTotalCards] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const doSearch = useCallback(async (q: string, f: string, p: number) => {
    if (!q.trim()) return;
    setLoading(true);
    setError("");
    try {
      const fullQ = [q, f].filter(Boolean).join(" ");
      const res = await fetch(`/api/scryfall/search?q=${encodeURIComponent(fullQ)}&page=${p}`);
      const data = await res.json();
      if (data.error) { setError("No cards found. Try a different search."); setCards([]); return; }
      setCards(data.data ?? []);
      setTotalCards(data.total_cards ?? 0);
      setHasMore(data.has_more ?? false);
    } catch {
      setError("Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialQ) doSearch(initialQ, filter, 1);
  }, []); // eslint-disable-line

  const handleSearch = (q: string) => {
    setQuery(q);
    setPage(1);
    router.push(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
    doSearch(q, filter, 1);
  };

  const handleFilter = (f: string) => {
    setFilter(f);
    setPage(1);
    if (query) doSearch(query, f, 1);
  };

  const handlePage = (p: number) => {
    setPage(p);
    doSearch(query, filter, p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-8">
      <div className="mb-6">
        <SearchBar initialValue={initialQ} onSearch={handleSearch} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map(f => (
          <button
            key={f.label}
            onClick={() => handleFilter(f.q)}
            className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition-all ${
              filter === f.q
                ? "bg-gold/15 text-gold border-gold/30"
                : "text-neutral border-bg-border hover:border-gold/20 hover:text-white"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results count */}
      {totalCards > 0 && (
        <div className="text-xs font-mono text-neutral mb-4">
          {totalCards.toLocaleString()} cards found
          {query && <> for <span className="text-gold">"{query}"</span></>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-neutral text-center py-16 font-mono">{error}</div>
      )}

      {/* Empty state */}
      {!loading && !error && cards.length === 0 && !query && (
        <div className="text-center py-24">
          <div className="text-6xl mb-4">🃏</div>
          <div className="font-display text-xl text-white mb-2">Search any Magic card</div>
          <div className="text-neutral text-sm">Try "Lightning Bolt", "Black Lotus", or any card name</div>
        </div>
      )}

      <CardGrid cards={cards} loading={loading} />

      {/* Pagination */}
      {(hasMore || page > 1) && !loading && (
        <div className="flex justify-center items-center gap-4 mt-10">
          <button
            onClick={() => handlePage(page - 1)}
            disabled={page === 1}
            className="flex items-center gap-2 text-sm font-mono px-4 py-2 rounded-lg border border-bg-border text-neutral hover:text-white hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-sm font-mono text-neutral">Page {page}</span>
          <button
            onClick={() => handlePage(page + 1)}
            disabled={!hasMore}
            className="flex items-center gap-2 text-sm font-mono px-4 py-2 rounded-lg border border-bg-border text-neutral hover:text-white hover:border-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-neutral font-mono">Loading...</div>}>
      <SearchContent />
    </Suspense>
  );
}
