"use client";

import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

const SORT_OPTIONS = [
  { key: "newest", label: "Newest" },
  { key: "ending", label: "Ending soonest" },
  { key: "pool", label: "Biggest pool" },
] as const;

type SortKey = (typeof SORT_OPTIONS)[number]["key"];

const PAGE_SIZE = 24;

const FILTER_KEYS = new Set<string>(FILTERS.map((f) => f.key));
const CATEGORY_KEYS = new Set<string>(CATEGORY_FILTERS.map((c) => c.key));
const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((s) => s.key));

export default function MarketsPage() {
  return (
    <Suspense fallback={null}>
      <MarketsContent />
    </Suspense>
  );
}

function MarketsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read state from URL with safe defaults
  const filter: FilterKey = (FILTER_KEYS.has(searchParams.get("status") ?? "")
    ? (searchParams.get("status") as FilterKey)
    : "all");
  const category: CategoryFilter = (CATEGORY_KEYS.has(searchParams.get("cat") ?? "")
    ? (searchParams.get("cat") as CategoryFilter)
    : "all");
  const sort: SortKey = (SORT_KEYS.has(searchParams.get("sort") ?? "")
    ? (searchParams.get("sort") as SortKey)
    : "newest");

  const search = searchParams.get("q") ?? "";
  const [searchInput, setSearchInput] = useState(search);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const { markets, total, isLoading } = useAllMarkets(pageSize);

  const updateParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/markets?${qs}` : "/markets", { scroll: false });
    },
    [router, searchParams]
  );

  const handleSearch = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      searchTimeout.current = setTimeout(() => {
        updateParam("q", value.trim(), "");
      }, 300);
    },
    [updateParam]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return markets.filter(({ market }) => {
      // Search filter
      if (q && !market.question.toLowerCase().includes(q) && !market.description.toLowerCase().includes(q)) {
        return false;
      }
      if (filter !== "all") {
        const s = statusFromMarket(market);
        if (filter === "resolved") {
          if (s !== "resolved" && s !== "invalid") return false;
        } else if (s !== filter) {
          return false;
        }
      }
      if (category !== "all") {
        const catName = CATEGORIES[market.category ?? 0];
        if (catName !== category) return false;
      }
      return true;
    });
  }, [markets, filter, category, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === "ending") {
      arr.sort((a, b) => {
        const aOpen = statusFromMarket(a.market) === "open";
        const bOpen = statusFromMarket(b.market) === "open";
        if (aOpen !== bOpen) return aOpen ? -1 : 1;
        return Number(a.market.closeTime - b.market.closeTime);
      });
    } else if (sort === "pool") {
      arr.sort((a, b) => {
        const aPool = a.market.yesPool + a.market.noPool;
        const bPool = b.market.yesPool + b.market.noPool;
        if (bPool > aPool) return 1;
        if (bPool < aPool) return -1;
        return 0;
      });
    }
    // "newest" is the default order from useAllMarkets
    return arr;
  }, [filtered, sort]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: markets.length };
    for (const c of CATEGORIES) counts[c] = 0;
    for (const { market } of markets) {
      const name = CATEGORIES[market.category ?? 0];
      if (name) counts[name] = (counts[name] ?? 0) + 1;
    }
    return counts;
  }, [markets]);

  const hasMore = total > pageSize;

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

      {/* Search bar */}
      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.5)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
        </div>
        <input
          type="text"
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search markets by question or description..."
          className="input-field w-full rounded-xl py-3 pl-11 pr-4 text-sm"
        />
        {searchInput && (
          <button
            onClick={() => handleSearch("")}
            className="absolute inset-y-0 right-0 flex items-center pr-4"
            style={{ color: "rgba(148,163,184,0.5)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => updateParam("status", f.key, "all")}
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

        <div className="flex items-center gap-2">
          <label
            htmlFor="sort-select"
            className="text-xs font-medium tracking-wider"
            style={{ color: "rgba(148,163,184,0.5)" }}
          >
            SORT
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => updateParam("sort", e.target.value, "newest")}
            className="rounded-xl px-3 py-2 text-sm font-medium"
            style={{
              background: "rgba(10,10,30,0.6)",
              border: "1px solid rgba(99,102,241,0.2)",
              color: "#e2e8f0",
            }}
          >
            {SORT_OPTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((c) => {
          const active = category === c.key;
          const count = categoryCounts[c.key] ?? 0;
          return (
            <button
              key={c.key}
              onClick={() => updateParam("cat", c.key, "all")}
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
      ) : sorted.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            {markets.length === 0
              ? "No markets yet. Be the first to create one!"
              : search
              ? `No markets matching "${search}".`
              : category !== "all"
              ? `No ${category} markets match this filter.`
              : "No markets match this filter."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map(({ id, market }) => (
              <MarketCard key={id.toString()} id={id} market={market} />
            ))}
          </div>

          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setPageSize((s) => s + PAGE_SIZE)}
                disabled={isLoading}
                className="rounded-xl px-6 py-3 text-sm font-medium transition disabled:opacity-50"
                style={{
                  background: "rgba(99,102,241,0.1)",
                  border: "1px solid rgba(99,102,241,0.25)",
                  color: "#a5b4fc",
                }}
              >
                {isLoading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round" />
                    </svg>
                    Loading…
                  </span>
                ) : (
                  `Load more · showing ${sorted.length} of ${total}`
                )}
              </button>
            </div>
          )}

          {!hasMore && sorted.length > 0 && (
            <div className="mt-8 text-center">
              <span className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
                Showing all {sorted.length} market{sorted.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}
        </>
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
