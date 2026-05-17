"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
  erc20Abi,
  predictionMarketAbi,
  statusFromMarket,
  type Market,
} from "@/lib/contract";
import { fmtAddr, fmtCompactUsd, fmtToken } from "@/lib/utils";
import { pushToast } from "@/lib/toast";
import { useEffect } from "react";

export default function DashboardPage() {
  const { address, isConnected } = useAccount();

  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const { data: idsRaw, refetch: refetchIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "getUserBets",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const ids = (idsRaw as bigint[] | undefined) ?? [];

  // Fetch all market structs + per-position bet sizes + claim status in one batch.
  const detailContracts = ids.flatMap((id) => [
    {
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: predictionMarketAbi,
      functionName: "getMarket" as const,
      args: [id] as const,
    },
    ...(address
      ? [
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: predictionMarketAbi,
            functionName: "yesBets" as const,
            args: [id, address] as const,
          },
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: predictionMarketAbi,
            functionName: "noBets" as const,
            args: [id, address] as const,
          },
          {
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: predictionMarketAbi,
            functionName: "hasClaimed" as const,
            args: [id, address] as const,
          },
        ]
      : []),
  ]);

  const batch = useReadContracts({
    contracts: detailContracts,
    query: { enabled: ids.length > 0 && !!address },
  });

  const positions = useMemo(() => {
    if (!batch.data || ids.length === 0) return [];
    const stride = 4;
    return ids.map((id, i) => {
      const market = batch.data[i * stride]?.result as Market | undefined;
      const yesBet = (batch.data[i * stride + 1]?.result as bigint | undefined) ?? 0n;
      const noBet = (batch.data[i * stride + 2]?.result as bigint | undefined) ?? 0n;
      const claimed = (batch.data[i * stride + 3]?.result as boolean | undefined) ?? false;
      return { id, market, yesBet, noBet, claimed };
    });
  }, [batch.data, ids]);

  const stats = useMemo(() => {
    let active = 0;
    let claimable = 0;
    let totalStaked = 0n;
    let totalSettled = 0n; // simple "potential" sum: claimed wins (counted as their bet) - claimed losses
    for (const p of positions) {
      if (!p.market) continue;
      const stake = p.yesBet + p.noBet;
      totalStaked += stake;
      const s = statusFromMarket(p.market);
      if (s === "open" || s === "closed") active++;
      const isWinner =
        (p.market.outcome === 1 && p.yesBet > 0n) ||
        (p.market.outcome === 2 && p.noBet > 0n);
      const isLoser =
        (p.market.outcome === 1 && p.noBet > 0n) ||
        (p.market.outcome === 2 && p.yesBet > 0n);
      if (isWinner && !p.claimed) claimable++;
      if (p.market.outcome === 3 && stake > 0n && !p.claimed) claimable++;
      if (isLoser) totalSettled -= stake; // realized loss
    }
    return { active, claimable, totalStaked, totalSettled };
  }, [positions]);

  const claimTx = useWriteContract();
  const refundTx = useWriteContract();
  const claimMined = useWaitForTransactionReceipt({ hash: claimTx.data });
  const refundMined = useWaitForTransactionReceipt({ hash: refundTx.data });

  useEffect(() => {
    if (claimMined.isSuccess) {
      pushToast("Claim successful", "success");
      claimTx.reset();
      refetchIds();
      batch.refetch();
    }
  }, [claimMined.isSuccess]); // eslint-disable-line
  useEffect(() => {
    if (refundMined.isSuccess) {
      pushToast("Refunded", "success");
      refundTx.reset();
      refetchIds();
      batch.refetch();
    }
  }, [refundMined.isSuccess]); // eslint-disable-line

  if (!isConnected) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="glass-card p-12">
          <h2 className="mb-3 text-2xl font-bold" style={{ color: "#f1f5f9" }}>
            Connect your wallet
          </h2>
          <p className="mb-6 text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            Sign in to view your positions and claimable winnings.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Dashboard
        </h2>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          Your positions and portfolio overview
        </p>
      </div>

      {/* Wallet card */}
      <div className="glass-card mb-8 p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
                <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
              </svg>
            </div>
            <div>
              <div className="mb-1 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
                CONNECTED WALLET
              </div>
              <div className="font-mono text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                {fmtAddr(address, 6, 4)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="mb-1 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
              {TOKEN_SYMBOL} BALANCE
            </div>
            <div className="text-lg font-semibold font-mono" style={{ color: "#e2e8f0" }}>
              {balance !== undefined ? fmtToken(balance as bigint, undefined, false) : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="ACTIVE BETS" value={stats.active.toString()} color="#e2e8f0" />
        <StatCard label="PENDING CLAIMS" value={stats.claimable.toString()} color="#fbbf24" />
        <StatCard label="TOTAL STAKED" value={fmtCompactUsd(stats.totalStaked)} color="#e2e8f0" />
        <StatCard
          label="REALIZED P&L"
          value={
            stats.totalSettled === 0n
              ? "—"
              : (stats.totalSettled > 0n ? "+" : "") + fmtCompactUsd(stats.totalSettled)
          }
          color={stats.totalSettled > 0n ? "#34d399" : stats.totalSettled < 0n ? "#f87171" : "#818cf8"}
        />
      </div>

      {/* Positions table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 pb-4">
          <h3 className="text-base font-semibold" style={{ color: "#e2e8f0" }}>
            Your Positions
          </h3>
        </div>
        <div className="overflow-x-auto">
          {positions.length === 0 ? (
            <div className="px-6 pb-8 text-center text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>
              You haven't placed any bets yet. <Link href="/markets" className="underline">Browse markets</Link>.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(99,102,241,0.1)" }}>
                  <Th>MARKET</Th>
                  <Th>SIDE</Th>
                  <Th>STAKE</Th>
                  <Th>STATUS</Th>
                  <Th align="right">ACTION</Th>
                </tr>
              </thead>
              <tbody>
                {positions.map(({ id, market, yesBet, noBet, claimed }) => {
                  if (!market) return null;
                  const stake = yesBet + noBet;
                  const sideLabel =
                    yesBet > 0n && noBet > 0n
                      ? "BOTH"
                      : yesBet > 0n
                      ? "YES"
                      : "NO";
                  const sideColor =
                    sideLabel === "YES" ? "#34d399" : sideLabel === "NO" ? "#f87171" : "#818cf8";
                  const status = statusFromMarket(market);
                  const isWinner =
                    (market.outcome === 1 && yesBet > 0n) || (market.outcome === 2 && noBet > 0n);
                  const canRefund = market.outcome === 3 && stake > 0n && !claimed;
                  const isLoser =
                    (market.outcome === 1 && noBet > 0n && yesBet === 0n) ||
                    (market.outcome === 2 && yesBet > 0n && noBet === 0n);

                  let action: React.ReactNode = (
                    <span className="text-xs" style={{ color: "rgba(148,163,184,0.3)" }}>—</span>
                  );
                  if (isWinner && !claimed) {
                    action = (
                      <button
                        disabled={claimTx.isPending || claimMined.isLoading}
                        onClick={() =>
                          claimTx.writeContract({
                            address: CONTRACT_ADDRESS,
                            abi: predictionMarketAbi,
                            functionName: "claim",
                            args: [id],
                          })
                        }
                        className="btn-primary rounded-lg px-4 py-1.5 text-xs font-semibold"
                      >
                        Claim
                      </button>
                    );
                  } else if (canRefund) {
                    action = (
                      <button
                        disabled={refundTx.isPending || refundMined.isLoading}
                        onClick={() =>
                          refundTx.writeContract({
                            address: CONTRACT_ADDRESS,
                            abi: predictionMarketAbi,
                            functionName: "refund",
                            args: [id],
                          })
                        }
                        className="btn-secondary rounded-lg px-4 py-1.5 text-xs font-semibold"
                      >
                        Refund
                      </button>
                    );
                  } else if (claimed) {
                    action = (
                      <span className="text-xs font-semibold" style={{ color: "#34d399" }}>Claimed ✓</span>
                    );
                  } else if (isLoser) {
                    action = (
                      <span className="text-xs" style={{ color: "rgba(248,113,113,0.7)" }}>Lost</span>
                    );
                  }

                  const badgeClass =
                    status === "open"
                      ? "badge-open"
                      : status === "resolved"
                      ? "badge-resolved"
                      : "badge-closed";

                  return (
                    <tr key={id.toString()} style={{ borderBottom: "1px solid rgba(99,102,241,0.06)" }}>
                      <td className="px-6 py-4">
                        <Link
                          href={`/markets/${id.toString()}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: "#e2e8f0" }}
                        >
                          {market.question}
                        </Link>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-xs font-semibold" style={{ color: sideColor }}>
                          {sideLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono" style={{ color: "#cbd5e1" }}>
                        {fmtToken(stake)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`${badgeClass} rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">{action}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </section>
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
