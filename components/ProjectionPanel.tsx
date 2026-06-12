"use client";

import { useEffect, useState } from "react";
import ProjectionFlipCard from "@/components/ProjectionFlipCard";
import type { Projection, PricePoint, WatchlistEntry } from "@/types";

interface Props {
  cardName: string;
  setCode: string;
  collectorNumber: string;
  imageUri: string;
  typeLine: string;
}

export default function ProjectionPanel({ cardName, setCode, collectorNumber, imageUri, typeLine }: Props) {
  const [projection, setProjection] = useState<Projection | null>(null);
  const [history, setHistory] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projections/${encodeURIComponent(cardName)}`).then((r) =>
        r.ok ? (r.json() as Promise<Projection>) : null
      ),
      fetch(`/api/prices?name=${encodeURIComponent(cardName)}`).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([proj, price]) => {
        if (proj) setProjection(proj);
        if (price?.history) setHistory(price.history);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [cardName]);

  const entry: WatchlistEntry = {
    id: `${cardName}_nonfoil`,
    card_name: cardName,
    set_code: setCode,
    set_name: "",
    collector_number: collectorNumber,
    finish: "nonfoil",
    image_uri: imageUri,
    type_line: typeLine,
    status: "watching",
    added_at: new Date().toISOString(),
  };

  if (loading) {
    return (
      <div className="text-xs font-mono text-neutral py-4 text-center">
        Loading projection…
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="text-xs font-mono text-neutral uppercase tracking-widest mb-3">
        Market Projection
      </div>
      <div className="flex justify-center">
        <ProjectionFlipCard
          entry={entry}
          projection={projection}
          priceHistory={history}
          showBack
          size="md"
        />
      </div>
    </div>
  );
}
