"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { sdk } from "@farcaster/miniapp-sdk";
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { BetPanel } from "@/components/BetPanel";
import { MarketActivity } from "@/components/MarketActivity";
import {
  CONTRACT_ADDRESS,
  PRICE_RESOLVER_ADDRESS,
  CATEGORIES,
  predictionMarketAbi,
  priceResolverAbi,
  type Market,
  statusFromMarket,
  APP_URL,
} from "@/lib/contract";
import { fmtAddr, fmtCompactUsd, fmtCountdown, fmtToken } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

const BADGE: Record<string, string> = {
  open: "badge-open",
  closed: "badge-closed",
  resolved: "badge-resolved",
  invalid: "badge-resolved",
};

export default function MarketDetailPage() {
  const params = useParams<{ id: string }>();
  const marketId = (() => {
    try {
      return BigInt(params.id);
    } catch {
      return undefined;
    }
  })();
  const { address } = useAccount();
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "getMarket",
    args: marketId !== undefined ? [marketId] : undefined,
    query: { enabled: marketId !== undefined, refetchInterval: 12_000 },
  });

  const userBatch = useReadContracts({
    contracts:
      address && marketId !== undefined
        ? [
            {
              address: CONTRACT_ADDRESS,
              abi: predictionMarketAbi,
              functionName: "yesBets" as const,
              args: [marketId, address] as const,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: predictionMarketAbi,
              functionName: "noBets" as const,
              args: [marketId, address] as const,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: predictionMarketAbi,
              functionName: "hasClaimed" as const,
              args: [marketId, address] as const,
            },
          ]
        : [],
    query: { enabled: !!address && marketId !== undefined },
  });

  const claimTx = useWriteContract();
  const refundTx = useWriteContract();
  const resolveTx = useWriteContract();
  const invalidateTx = useWriteContract();
  const claimMined = useWaitForTransactionReceipt({ hash: claimTx.data });
  const refundMined = useWaitForTransactionReceipt({ hash: refundTx.data });
  const resolveMined = useWaitForTransactionReceipt({ hash: resolveTx.data });
  const invalidateMined = useWaitForTransactionReceipt({ hash: invalidateTx.data });

  useEffect(() => {
    if (claimMined.isSuccess) {
      pushToast("Claim successful!", "success");
      claimTx.reset();
      refetch();
      userBatch.refetch();
      setRefreshKey((k) => k + 1);
    }
  }, [claimMined.isSuccess]); // eslint-disable-line
  useEffect(() => {
    if (refundMined.isSuccess) {
      pushToast("Stake refunded", "success");
      refundTx.reset();
      refetch();
      userBatch.refetch();
      setRefreshKey((k) => k + 1);
    }
  }, [refundMined.isSuccess]); // eslint-disable-line
  useEffect(() => {
    if (resolveMined.isSuccess) {
      pushToast("Market resolved", "success");
      resolveTx.reset();
      refetch();
      setRefreshKey((k) => k + 1);
    }
  }, [resolveMined.isSuccess]); // eslint-disable-line
  useEffect(() => {
    if (invalidateMined.isSuccess) {
      pushToast("Market marked invalid", "info");
      invalidateTx.reset();
      refetch();
      setRefreshKey((k) => k + 1);
    }
  }, [invalidateMined.isSuccess]); // eslint-disable-line

  if (marketId === undefined) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p>Invalid market ID.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="glass-card h-48 animate-pulse" />
      </div>
    );
  }

  const market = data as Market;
  const status = statusFromMarket(market);
  const total = market.yesPool + market.noPool;
  const yesPct = total === 0n ? 50 : Number((market.yesPool * 10000n) / total) / 100;
  const noPct = 100 - yesPct;
  const closeSec = Number(market.closeTime);
  const isResolver = !!address && address.toLowerCase() === market.resolver.toLowerCase();

  const myYes = (userBatch.data?.[0]?.result as bigint | undefined) ?? 0n;
  const myNo = (userBatch.data?.[1]?.result as bigint | undefined) ?? 0n;
  const claimed = (userBatch.data?.[2]?.result as boolean | undefined) ?? false;

  const isWinner = (market.outcome === 1 && myYes > 0n) || (market.outcome === 2 && myNo > 0n);
  const canRefund = market.outcome === 3 && (myYes > 0n || myNo > 0n) && !claimed;

  // Grace period: 7 days after closeTime. After that, anyone can mark invalid.
  const GRACE_SEC = 7 * 24 * 3600;
  const graceEndsAt = closeSec + GRACE_SEC;
  const nowSec = Math.floor(Date.now() / 1000);
  const inGracePeriod = market.outcome === 0 && nowSec >= closeSec && nowSec < graceEndsAt;
  const canMarkInvalid = market.outcome === 0 && nowSec >= graceEndsAt;

  const statusLabel =
    status === "resolved" && market.outcome === 1
      ? "YES won"
      : status === "resolved" && market.outcome === 2
      ? "NO won"
      : status === "invalid"
      ? "invalid"
      : status;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/markets"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium"
        style={{ color: "rgba(148,163,184,0.6)" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M19 12H5" />
          <path d="M12 19l-7-7 7-7" />
        </svg>
        Back to Markets
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="glass-card mb-6 p-6 sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold sm:text-2xl" style={{ color: "#f1f5f9" }}>
                {market.question}
              </h2>
              <span
                className={`${BADGE[status]} flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize`}
              >
                {statusLabel}
              </span>
            </div>
            {market.description && (
              <p
                className="mb-6 whitespace-pre-line text-sm leading-relaxed"
                style={{ color: "rgba(148,163,184,0.7)" }}
              >
                {market.description}
              </p>
            )}
            <p className="mb-6 font-mono text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
              by {fmtAddr(market.creator)} · resolver {fmtAddr(market.resolver)}
            </p>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="TOTAL POOL" value={fmtCompactUsd(total)} />
              <Stat label="TIME LEFT" value={status === "open" ? fmtCountdown(closeSec) : statusLabel} mono />
              <Stat
                label="PARTICIPANTS"
                value={(market.yesBettors + market.noBettors).toString()}
                className="col-span-2 sm:col-span-1"
              />
            </div>

            <div className="mb-2">
              <div className="mb-2 flex justify-between text-xs font-medium">
                <span style={{ color: "#34d399" }}>YES {yesPct.toFixed(1)}%</span>
                <span style={{ color: "#f87171" }}>NO {noPct.toFixed(1)}%</span>
              </div>
              <div
                className="h-3 w-full overflow-hidden rounded-full"
                style={{ background: "rgba(20,20,40,0.8)" }}
              >
                <div
                  className="pool-bar-yes h-full rounded-full transition-all duration-700"
                  style={{ width: `${yesPct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
                <span>{fmtToken(market.yesPool)}</span>
                <span>{fmtToken(market.noPool)}</span>
              </div>
            </div>

            {/* Action area for non-betting flows */}
            <div className="mt-6 flex flex-wrap gap-3">
              {isWinner && !claimed && (
                <button
                  className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                  disabled={claimTx.isPending || claimMined.isLoading}
                  onClick={() =>
                    claimTx.writeContract({
                      address: CONTRACT_ADDRESS,
                      abi: predictionMarketAbi,
                      functionName: "claim",
                      args: [marketId],
                    })
                  }
                >
                  {claimTx.isPending || claimMined.isLoading ? "Claiming…" : "Claim winnings"}
                </button>
              )}
              {canRefund && (
                <button
                  className="btn-secondary rounded-xl px-5 py-2.5 text-sm"
                  disabled={refundTx.isPending || refundMined.isLoading}
                  onClick={() =>
                    refundTx.writeContract({
                      address: CONTRACT_ADDRESS,
                      abi: predictionMarketAbi,
                      functionName: "refund",
                      args: [marketId],
                    })
                  }
                >
                  {refundTx.isPending || refundMined.isLoading ? "Refunding…" : "Refund stake"}
                </button>
              )}
              {status === "closed" && isResolver && (
                <>
                  <button
                    className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                    style={{ background: "linear-gradient(135deg,#10b981,#34d399)" }}
                    disabled={resolveTx.isPending || resolveMined.isLoading}
                    onClick={() =>
                      resolveTx.writeContract({
                        address: CONTRACT_ADDRESS,
                        abi: predictionMarketAbi,
                        functionName: "resolve",
                        args: [marketId, true],
                      })
                    }
                  >
                    Resolve YES
                  </button>
                  <button
                    className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                    style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
                    disabled={resolveTx.isPending || resolveMined.isLoading}
                    onClick={() =>
                      resolveTx.writeContract({
                        address: CONTRACT_ADDRESS,
                        abi: predictionMarketAbi,
                        functionName: "resolve",
                        args: [marketId, false],
                      })
                    }
                  >
                    Resolve NO
                  </button>
                </>
              )}
              {canMarkInvalid && (
                <button
                  className="btn-secondary rounded-xl px-5 py-2.5 text-sm"
                  disabled={invalidateTx.isPending || invalidateMined.isLoading}
                  onClick={() =>
                    invalidateTx.writeContract({
                      address: CONTRACT_ADDRESS,
                      abi: predictionMarketAbi,
                      functionName: "markInvalid",
                      args: [marketId],
                    })
                  }
                >
                  Grace expired — mark invalid
                </button>
              )}
              {status === "closed" && market.resolver.toLowerCase() === PRICE_RESOLVER_ADDRESS.toLowerCase() && PRICE_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000" && (
                <button
                  className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                  style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}
                  disabled={resolveTx.isPending || resolveMined.isLoading}
                  onClick={() =>
                    resolveTx.writeContract({
                      address: PRICE_RESOLVER_ADDRESS,
                      abi: priceResolverAbi,
                      functionName: "resolveMarket",
                      args: [marketId],
                    })
                  }
                >
                  {resolveTx.isPending || resolveMined.isLoading ? "Resolving…" : "⚡ Auto-resolve (Chainlink)"}
                </button>
              )}
            </div>

            {/* Grace period countdown — shown when closed but resolver hasn't acted yet */}
            {inGracePeriod && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-xs"
                style={{
                  background: "rgba(251,191,36,0.08)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  color: "#fcd34d",
                }}
              >
                <div className="font-semibold" style={{ color: "#fde68a" }}>
                  Awaiting resolver
                </div>
                <div className="mt-1" style={{ color: "rgba(253,230,138,0.75)" }}>
                  If not resolved, refunds become available in {fmtCountdown(graceEndsAt)}.
                </div>
              </div>
            )}

            {/* Share buttons */}
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={async () => {
                  const marketUrl = `${APP_URL}/markets/${marketId.toString()}`;
                  const text = `${market.question}\n\nBet on it:`;
                  // Try native Farcaster compose first (when running inside a Farcaster client),
                  // fall back to the warpcast.com web compose URL on plain web.
                  try {
                    const isMini = await sdk.isInMiniApp();
                    if (isMini) {
                      await sdk.actions.composeCast({ text, embeds: [marketUrl] });
                      return;
                    }
                  } catch {
                    // SDK not available or rejected — fall through to web fallback
                  }
                  const shareUrl = `https://warpcast.com/~/compose?text=${encodeURIComponent(
                    text
                  )}&embeds[]=${encodeURIComponent(marketUrl)}`;
                  window.open(shareUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition hover:bg-white/5"
                style={{ border: "1px solid rgba(139,92,246,0.3)", color: "#c4b5fd" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
                Share on Farcaster
              </button>
              <button
                onClick={() => {
                  const marketUrl = `${APP_URL}/markets/${marketId.toString()}`;
                  const text = `${market.question}\n\nPredict now on @mindset_base:`;
                  const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(marketUrl)}`;
                  window.open(twitterUrl, "_blank", "noopener,noreferrer");
                }}
                className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-medium transition hover:bg-white/5"
                style={{ border: "1px solid rgba(148,163,184,0.2)", color: "rgba(148,163,184,0.7)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </button>
            </div>

            {(myYes > 0n || myNo > 0n) && (
              <div
                className="mt-6 rounded-xl px-4 py-3 text-sm"
                style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.18)" }}
              >
                <div className="text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                  Your position
                </div>
                <div className="mt-1 flex flex-wrap gap-3">
                  {myYes > 0n && <span style={{ color: "#34d399" }}>YES {fmtToken(myYes)}</span>}
                  {myNo > 0n && <span style={{ color: "#f87171" }}>NO {fmtToken(myNo)}</span>}
                </div>
              </div>
            )}
          </div>

          <div className="glass-card p-6">
            <h3 className="mb-4 text-base font-semibold" style={{ color: "#e2e8f0" }}>
              Pool Activity
            </h3>
            <MarketActivity marketId={marketId} refreshKey={refreshKey} />
          </div>
        </div>

        <div className="lg:col-span-2">
          <BetPanel
            marketId={marketId}
            market={market}
            onPlaced={() => {
              refetch();
              userBatch.refetch();
              setRefreshKey((k) => k + 1);
            }}
          />
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl p-4 ${className ?? ""}`}
      style={{ background: "rgba(10,10,30,0.5)", border: "1px solid rgba(99,102,241,0.08)" }}
    >
      <div className="mb-1 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
        {label}
      </div>
      <div
        className={`text-lg font-bold ${mono ? "font-mono" : ""}`}
        style={{ color: "#e2e8f0" }}
      >
        {value}
      </div>
    </div>
  );
}
