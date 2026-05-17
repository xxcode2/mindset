"use client";

import { useMemo, useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { useAllMarkets } from "@/lib/hooks";
import { isContractConfigured, statusFromMarket } from "@/lib/contract";
import { classNames } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "resolved", label: "Resolved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function MarketsPage() {
  const { markets, isLoading } = useAllMarkets();
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return markets;
    return markets.filter(({ market }) => {
      const s = statusFromMarket(market);
      if (filter === "resolved") return s === "resolved" || s === "invalid";
      return s === filter;
    });
  }, [markets, filter]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Prediction Markets
        </h2>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          Browse open markets and place YES/NO predictions
        </p>
      </div>

      {!isContractConfigured && <NotConfiguredBanner />}

      <div className="mb-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={classNames(
              "rounded-xl px-4 py-2 text-sm font-medium transition",
              filter === f.key
                ? "border-[rgba(99,102,241,0.3)] bg-[rgba(99,102,241,0.15)] text-[#818cf8]"
                : "border-[rgba(148,163,184,0.15)] bg-transparent text-[rgba(148,163,184,0.6)] hover:text-white"
            )}
            style={{ borderWidth: 1, borderStyle: "solid" }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-card h-56 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            {markets.length === 0 ? "No markets yet. Be the first to create one!" : "No markets match this filter."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ id, market }) => (
            <MarketCard key={id.toString()} id={id} market={market} />
          ))}
        </div>
      )}
    </section>
  );
}

function NotConfiguredBanner() {
  return (
    <div
      className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
      style={{ color: "#fde68a" }}
    >
      <p className="font-medium">Contract not configured</p>
      <p className="text-sm" style={{ color: "rgba(253,230,138,0.8)" }}>
        Deploy the contract and set <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> + <code>NEXT_PUBLIC_TOKEN_ADDRESS</code> in <code>frontend/.env.local</code>.
      </p>
    </div>
  );
}
