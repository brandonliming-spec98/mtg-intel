"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2 } from "lucide-react";

interface Props {
  initialValue?: string;
  large?: boolean;
  onSearch?: (query: string) => void;
}

export default function SearchBar({ initialValue = "", large = false, onSearch }: Props) {
  const [query, setQuery] = useState(initialValue);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/scryfall/autocomplete?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  const handleSearch = (q: string) => {
    if (!q.trim()) return;
    setOpen(false);
    setSuggestions([]);
    if (onSearch) {
      onSearch(q);
    } else {
      router.push(`/search?q=${encodeURIComponent(q)}`);
    }
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    handleSearch(name);
  };

  return (
    <div className={`relative ${large ? "w-full max-w-2xl" : "w-full"}`}>
      <div className={`flex items-center gap-3 bg-bg-elevated border border-bg-border rounded-xl transition-all ${
        open ? "border-gold/40 ring-1 ring-gold/20" : "hover:border-gold/20"
      } ${large ? "px-5 py-4" : "px-4 py-3"}`}>
        <Search size={large ? 20 : 16} className="text-neutral flex-shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onKeyDown={e => { if (e.key === "Enter") handleSearch(query); if (e.key === "Escape") setOpen(false); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search any Magic card..."
          className={`flex-1 bg-transparent outline-none text-white placeholder:text-neutral ${
            large ? "text-lg" : "text-sm"
          }`}
        />
        {loading && <Loader2 size={14} className="text-gold animate-spin flex-shrink-0" />}
        {query && !loading && (
          <button onClick={() => { setQuery(""); setSuggestions([]); inputRef.current?.focus(); }}>
            <X size={14} className="text-neutral hover:text-white transition-colors" />
          </button>
        )}
      </div>

      {/* Autocomplete dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-bg-elevated border border-bg-border rounded-xl overflow-hidden shadow-2xl z-50 animate-slide-up">
          {suggestions.map(name => (
            <button
              key={name}
              onMouseDown={() => handleSelect(name)}
              className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-gold/10 hover:text-gold-light transition-colors flex items-center gap-3"
            >
              <Search size={12} className="text-neutral flex-shrink-0" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
