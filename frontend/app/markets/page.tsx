"use client";

import { useMemo, useState } from "react";
import { MarketCard } from "@/components/MarketCard";
import { useAllMarkets } from "@/lib/hooks";
import { CATEGORIES, isContractConfigured, statusFromMarket } from "@/lib/contract";
import { classNames } from "@/lib/utils";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "closed", label: "Closed" },
  { key: "resolved", label: "Resolved" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type CategoryFilter = "all" | (typeof CATEGORIES)[number];

const CATEGORY_FILTERS: { key: CategoryFilter; label: string; icon?: string }[] = [
  { key: "all", label: "All" },
  { key: "Crypto", label: "Crypto", icon: "🪙" },
  { key: "Sports", label: "Sports", icon: "⚽" },
  { key: "Price", label: "Price", icon: "📈" },
  { key: "Politics", label: "Politics", icon: "🏛️" },
  { key: "Social", label: "Social", icon: "💬" },
  { key: "Custom", label: "Custom", icon: "⚙️" },
];

export default function MarketsPage() {
  const { markets, isLoading } = useAllMarkets();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [category, setCategory] = useState<CategoryFilter>("all");

  const filtered = useMemo(() => {
    return markets.filter(({ market }) => {
      // Status filter
      if (filter !== "all") {
        const s = statusFromMarket(market);
        if (filter === "resolved") {
          if (s !== "resolved" && s !== "invalid") return false;
        } else if (s !== filter) {
          return false;
        }
      }
      // Category filter
      if (category !== "all") {
        const catName = CATEGORIES[market.category ?? 0];
        if (catName !== category) return false;
      }
      return true;
    });
  }, [markets, filter, category]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: markets.length };
    for (const c of CATEGORIES) counts[c] = 0;
    for (const { market } of markets) {
      const name = CATEGORIES[market.category ?? 0];
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [markets]);

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

      <div className="mb-4 flex flex-wrap gap-2">
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

      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((c) => {
          const active = category === c.key;
          const count = categoryCounts[c.key] ?? 0;
          return (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={classNames(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-[rgba(99,102,241,0.35)] bg-[rgba(99,102,241,0.12)] text-[#a5b4fc]"
                  : "border-[rgba(148,163,184,0.12)] bg-transparent text-[rgba(148,163,184,0.55)] hover:text-white"
              )}
              style={{ borderWidth: 1, borderStyle: "solid" }}
            >
              {c.icon && <span>{c.icon}</span>}
              <span>{c.label}</span>
              <span
                className="rounded-full px-1.5 py-px font-mono text-[10px]"
                style={{
                  background: active ? "rgba(99,102,241,0.18)" : "rgba(148,163,184,0.08)",
                  color: active ? "#c7d2fe" : "rgba(148,163,184,0.6)",
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
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
            {markets.length === 0
              ? "No markets yet. Be the first to create one!"
              : category !== "all"
              ? `No ${category} markets match this filter.`
              : "No markets match this filter."}
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
