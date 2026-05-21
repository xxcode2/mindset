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
  pending: "badge-pending",
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

  // Static contract config — owner, resolver bond, review period, and whether the
  // market's resolver is on the trusted whitelist (instant-finalize, no bond).
  const configBatch = useReadContracts({
    contracts: [
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "owner" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "resolverBond" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "REVIEW_PERIOD" as const },
    ],
  });
  const ownerAddr = configBatch.data?.[0]?.result as `0x${string}` | undefined;
  const resolverBond = (configBatch.data?.[1]?.result as bigint | undefined) ?? 0n;
  const reviewPeriodSec = Number(configBatch.data?.[2]?.result ?? 259200n); // 3 days fallback
  const configError = configBatch.isError;

  const market = data as Market | undefined;
  const isTrustedResolverRead = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "trustedResolver",
    args: market ? [market.resolver] : undefined,
    query: { enabled: !!market },
  });
  const isTrustedResolver = (isTrustedResolverRead.data as boolean | undefined) ?? false;

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
  const reviewTx = useWriteContract();
  const claimMined = useWaitForTransactionReceipt({ hash: claimTx.data });
  const refundMined = useWaitForTransactionReceipt({ hash: refundTx.data });
  const resolveMined = useWaitForTransactionReceipt({ hash: resolveTx.data });
  const invalidateMined = useWaitForTransactionReceipt({ hash: invalidateTx.data });
  const reviewMined = useWaitForTransactionReceipt({ hash: reviewTx.data });

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
  useEffect(() => {
    if (reviewMined.isSuccess) {
      pushToast("Review action confirmed", "success");
      reviewTx.reset();
      refetch();
      setRefreshKey((k) => k + 1);
    }
  }, [reviewMined.isSuccess]); // eslint-disable-line

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
        {configError && (
          <div className="mt-4 rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }}>
            Failed to load some contract config. RPC may be down.
          </div>
        )}
      </div>
    );
  }

  // `market` was already extracted above for the trustedResolver lookup; assert non-null here.
  const m = market as Market;
  const status = statusFromMarket(m);
  const total = m.yesPool + m.noPool;
  const yesPct = total === 0n ? 50 : Number((m.yesPool * 10000n) / total) / 100;
  const noPct = 100 - yesPct;
  const closeSec = Number(m.closeTime);
  const isResolver = !!address && address.toLowerCase() === m.resolver.toLowerCase();
  const isOwner = !!address && !!ownerAddr && address.toLowerCase() === ownerAddr.toLowerCase();

  const myYes = (userBatch.data?.[0]?.result as bigint | undefined) ?? 0n;
  const myNo = (userBatch.data?.[1]?.result as bigint | undefined) ?? 0n;
  const claimed = (userBatch.data?.[2]?.result as boolean | undefined) ?? false;

  const isWinner = (m.outcome === 1 && myYes > 0n) || (m.outcome === 2 && myNo > 0n);
  const canRefund = m.outcome === 3 && (myYes > 0n || myNo > 0n) && !claimed;

  // Two-phase resolution state
  const hasPendingProposal = m.proposedOutcome !== 0;
  const proposedAt = Number(m.proposedAt);
  const reviewDeadline = proposedAt + reviewPeriodSec;
  const nowSec = Math.floor(Date.now() / 1000);
  const inReview = hasPendingProposal && nowSec < reviewDeadline;
  const pastReview = hasPendingProposal && nowSec >= reviewDeadline;
  const proposedLabel = m.proposedOutcome === 1 ? "YES" : m.proposedOutcome === 2 ? "NO" : "—";

  // Grace period: 7 days after closeTime. After that, anyone can mark invalid.
  // (Not allowed while a proposal is pending — finalizeIfTimeout handles that branch.)
  const GRACE_SEC = 7 * 24 * 3600;
  const graceEndsAt = closeSec + GRACE_SEC;
  const inGracePeriod =
    m.outcome === 0 && !hasPendingProposal && nowSec >= closeSec && nowSec < graceEndsAt;
  const canMarkInvalid =
    m.outcome === 0 && !hasPendingProposal && nowSec >= graceEndsAt;

  const statusLabel =
    status === "resolved" && m.outcome === 1
      ? "YES won"
      : status === "resolved" && m.outcome === 2
      ? "NO won"
      : status === "invalid"
      ? "invalid"
      : status === "pending"
      ? "review"
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
                {m.question}
              </h2>
              <span
                className={`${BADGE[status]} flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold capitalize`}
              >
                {statusLabel}
              </span>
            </div>
            {m.description && (
              <p
                className="mb-6 whitespace-pre-line text-sm leading-relaxed"
                style={{ color: "rgba(148,163,184,0.7)" }}
              >
                {m.description}
              </p>
            )}
            <p className="mb-6 font-mono text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
              by {fmtAddr(m.creator)} · resolver {fmtAddr(m.resolver)}
            </p>
            <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat label="TOTAL POOL" value={fmtCompactUsd(total)} />
              <Stat label="TIME LEFT" value={status === "open" ? fmtCountdown(closeSec) : statusLabel} mono />
              <Stat
                label="PARTICIPANTS"
                value={(m.yesBettors + m.noBettors).toString()}
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
                <span>{fmtToken(m.yesPool)}</span>
                <span>{fmtToken(m.noPool)}</span>
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
              {status === "closed" && isResolver && !hasPendingProposal && (
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
                    {isTrustedResolver ? "Resolve YES" : "Propose YES"}
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
                    {isTrustedResolver ? "Resolve NO" : "Propose NO"}
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
              {status === "closed" && m.resolver.toLowerCase() === PRICE_RESOLVER_ADDRESS.toLowerCase() && PRICE_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000" && !hasPendingProposal && (
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

            {/* Resolver hint — non-trusted human resolver about to propose */}
            {status === "closed" && isResolver && !isTrustedResolver && !hasPendingProposal && (
              <div
                className="mt-4 rounded-xl px-4 py-3 text-xs"
                style={{
                  background: "rgba(99,102,241,0.08)",
                  border: "1px solid rgba(99,102,241,0.2)",
                  color: "#a5b4fc",
                }}
              >
                <div className="font-semibold" style={{ color: "#c7d2fe" }}>
                  Human resolver — proposal flow
                </div>
                <div className="mt-1" style={{ color: "rgba(199,210,254,0.75)" }}>
                  Your call locks a {fmtToken(resolverBond)} bond and starts a 3-day owner-review
                  window. If approved or unchallenged, the bond returns to you. If rejected, the bond
                  is forfeited and the market becomes invalid.
                </div>
              </div>
            )}

            {/* Pending review panel — shown to everyone while a proposal is awaiting decision */}
            {hasPendingProposal && (
              <div
                className="mt-4 rounded-xl px-4 py-4"
                style={{
                  background: "rgba(244,114,182,0.06)",
                  border: "1px solid rgba(244,114,182,0.25)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold tracking-wider" style={{ color: "#f472b6" }}>
                      OUTCOME PROPOSED · AWAITING REVIEW
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 text-sm">
                      <span style={{ color: "rgba(148,163,184,0.7)" }}>Resolver picked</span>
                      <span
                        className="rounded-md px-2 py-0.5 font-semibold"
                        style={{
                          background:
                            m.proposedOutcome === 1
                              ? "rgba(52,211,153,0.15)"
                              : "rgba(248,113,113,0.15)",
                          color: m.proposedOutcome === 1 ? "#34d399" : "#f87171",
                        }}
                      >
                        {proposedLabel}
                      </span>
                    </div>
                  </div>
                  <div className="text-right text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                    {inReview ? (
                      <>
                        <div>Review ends in</div>
                        <div className="font-mono text-sm" style={{ color: "#f472b6" }}>
                          {fmtCountdown(reviewDeadline)}
                        </div>
                      </>
                    ) : (
                      <div className="font-semibold" style={{ color: "#f472b6" }}>
                        Review window ended
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
                  Bond locked: <span className="font-mono">{fmtToken(m.resolverBondLocked)}</span> · 
                  Resolver: <span className="font-mono">{fmtAddr(m.resolver)}</span>
                </div>

                {/* Owner controls during review window */}
                {isOwner && inReview && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                      style={{ background: "linear-gradient(135deg,#10b981,#34d399)" }}
                      disabled={reviewTx.isPending || reviewMined.isLoading}
                      onClick={() =>
                        reviewTx.writeContract({
                          address: CONTRACT_ADDRESS,
                          abi: predictionMarketAbi,
                          functionName: "approveOutcome",
                          args: [marketId],
                        })
                      }
                    >
                      Approve {proposedLabel}
                    </button>
                    <button
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                      style={{ background: "linear-gradient(135deg,#dc2626,#f87171)" }}
                      disabled={reviewTx.isPending || reviewMined.isLoading}
                      onClick={() =>
                        reviewTx.writeContract({
                          address: CONTRACT_ADDRESS,
                          abi: predictionMarketAbi,
                          functionName: "rejectOutcome",
                          args: [marketId],
                        })
                      }
                    >
                      Reject — slash bond + invalidate
                    </button>
                  </div>
                )}

                {/* Owner can still approve after the window. Reject is locked though. */}
                {isOwner && pastReview && (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary rounded-xl px-5 py-2.5 text-sm"
                      style={{ background: "linear-gradient(135deg,#10b981,#34d399)" }}
                      disabled={reviewTx.isPending || reviewMined.isLoading}
                      onClick={() =>
                        reviewTx.writeContract({
                          address: CONTRACT_ADDRESS,
                          abi: predictionMarketAbi,
                          functionName: "approveOutcome",
                          args: [marketId],
                        })
                      }
                    >
                      Approve {proposedLabel} (reject window expired)
                    </button>
                  </div>
                )}

                {/* Anyone can finalize after the window. Default-trust kicks in. */}
                {pastReview && (
                  <div className="mt-4">
                    <button
                      className="btn-secondary rounded-xl px-5 py-2.5 text-sm"
                      disabled={reviewTx.isPending || reviewMined.isLoading}
                      onClick={() =>
                        reviewTx.writeContract({
                          address: CONTRACT_ADDRESS,
                          abi: predictionMarketAbi,
                          functionName: "finalizeIfTimeout",
                          args: [marketId],
                        })
                      }
                    >
                      {reviewTx.isPending || reviewMined.isLoading
                        ? "Finalizing…"
                        : `Finalize ${proposedLabel} (auto-approve)`}
                    </button>
                  </div>
                )}

                {!isOwner && inReview && (
                  <p className="mt-3 text-xs italic" style={{ color: "rgba(148,163,184,0.5)" }}>
                    Only the contract owner can approve or reject this proposal during the review
                    window. After the window ends anyone can finalize the resolver's call.
                  </p>
                )}
              </div>
            )}

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
                  const text = `${m.question}\n\nBet on it:`;
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
                  const text = `${m.question}\n\nPredict now on @mindset_base:`;
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
            market={m}
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
