"use client";

import { useMemo } from "react";
import { useAllMarkets } from "@/lib/hooks";
import { fmtAddr, fmtCompactUsd } from "@/lib/utils";
import { type Market } from "@/lib/contract";

type LeaderEntry = {
  address: string;
  totalStaked: bigint;
  marketsParticipated: number;
  yesCount: number;
  noCount: number;
};

/**
 * Leaderboard page — shows top participants by total staked volume.
 * Data is derived from on-chain market data (pool sizes & bettor counts).
 * Note: Since we can't enumerate individual bettors from contract reads alone,
 * we show market creators and aggregate market-level stats as a proxy.
 */
export default function LeaderboardPage() {
  const { markets, isLoading } = useAllMarkets(200);

  // Aggregate stats by market creator (the only address we can reliably extract without indexer)
  const leaderboard = useMemo(() => {
    if (!markets || markets.length === 0) return [];

    const creators = new Map<string, { totalPool: bigint; marketsCreated: number; totalBettors: number }>();

    for (const { market } of markets) {
      const addr = market.creator.toLowerCase();
      const existing = creators.get(addr) ?? { totalPool: 0n, marketsCreated: 0, totalBettors: 0 };
      existing.totalPool += market.yesPool + market.noPool;
      existing.marketsCreated += 1;
      existing.totalBettors += market.yesBettors + market.noBettors;
      creators.set(addr, existing);
    }

    return Array.from(creators.entries())
      .map(([address, stats]) => ({ address, ...stats }))
      .sort((a, b) => {
        // Sort by total pool attracted, then by markets created
        if (b.totalPool !== a.totalPool) return b.totalPool > a.totalPool ? 1 : -1;
        return b.marketsCreated - a.marketsCreated;
      })
      .slice(0, 50);
  }, [markets]);

  // Global stats
  const globalStats = useMemo(() => {
    if (!markets || markets.length === 0) return { totalVolume: 0n, totalMarkets: 0, totalBets: 0, uniqueCreators: 0 };
    const creatorsSet = new Set<string>();
    let totalVolume = 0n;
    let totalBets = 0;
    for (const { market } of markets) {
      totalVolume += market.yesPool + market.noPool;
      totalBets += market.yesBettors + market.noBettors;
      creatorsSet.add(market.creator.toLowerCase());
    }
    return { totalVolume, totalMarkets: markets.length, totalBets, uniqueCreators: creatorsSet.size };
  }, [markets]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Leaderboard
        </h2>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          Top market creators ranked by total pool volume attracted
        </p>
      </div>

      {/* Global Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="TOTAL VOLUME"
          value={isLoading ? "—" : fmtCompactUsd(globalStats.totalVolume)}
          color="#e2e8f0"
        />
        <StatCard
          label="MARKETS"
          value={isLoading ? "—" : globalStats.totalMarkets.toString()}
          color="#a5b4fc"
        />
        <StatCard
          label="TOTAL BETS"
          value={isLoading ? "—" : globalStats.totalBets.toLocaleString()}
          color="#34d399"
        />
        <StatCard
          label="CREATORS"
          value={isLoading ? "—" : globalStats.uniqueCreators.toString()}
          color="#fbbf24"
        />
      </div>

      {/* Leaderboard Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
            Top Market Creators
          </h3>
        </div>

        {isLoading ? (
          <div className="space-y-3 px-6 pb-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="px-6 pb-8 text-center text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>
            No market data available yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                  <Th>RANK</Th>
                  <Th>CREATOR</Th>
                  <Th>MARKETS</Th>
                  <Th>TOTAL BETS</Th>
                  <Th align="right">VOLUME ATTRACTED</Th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, i) => (
                  <tr key={entry.address} style={{ borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                    <td className="px-6 py-4">
                      <RankBadge rank={i + 1} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium" style={{ color: "#e2e8f0" }}>
                        {fmtAddr(entry.address, 6, 4)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: "#a5b4fc" }}>
                        {entry.marketsCreated}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
                        {entry.totalBettors}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono text-sm font-semibold" style={{ color: "#34d399" }}>
                        {fmtCompactUsd(entry.totalPool)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? { background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24" }
      : rank === 2
      ? { background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.25)", color: "#cbd5e1" }
      : rank === 3
      ? { background: "rgba(217,119,6,0.1)", border: "1px solid rgba(217,119,6,0.25)", color: "#d97706" }
      : { background: "transparent", border: "1px solid rgba(99,102,241,0.1)", color: "rgba(148,163,184,0.5)" };

  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
      style={style}
    >
      {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
    </span>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`px-6 py-3 text-${align} text-xs font-medium tracking-wider`}
      style={{ color: "rgba(148,163,184,0.4)" }}
    >
      {children}
    </th>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-2 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
        {label}
      </div>
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
