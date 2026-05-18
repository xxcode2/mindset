"use client";

import { useReadContract } from "wagmi";
import {
  PRICE_RESOLVER_ADDRESS,
  COMPARATORS,
  PRICE_FEEDS,
  priceResolverAbi,
  type ComparatorIndex,
} from "@/lib/contract";

/**
 * Shows live Chainlink price feed data for a Price-category market.
 * Displays: current price, threshold, comparator, and whether it would resolve YES or NO right now.
 */
export function PriceDisplay({ marketId }: { marketId: bigint }) {
  // Read the registered condition for this market
  const { data: conditionData } = useReadContract({
    address: PRICE_RESOLVER_ADDRESS,
    abi: priceResolverAbi,
    functionName: "conditions",
    args: [marketId],
    query: {
      enabled: PRICE_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000",
    },
  });

  // Read current preview resolution
  const { data: previewData, isLoading: previewLoading } = useReadContract({
    address: PRICE_RESOLVER_ADDRESS,
    abi: priceResolverAbi,
    functionName: "previewResolution",
    args: [marketId],
    query: {
      enabled:
        PRICE_RESOLVER_ADDRESS !== "0x0000000000000000000000000000000000000000" &&
        !!conditionData,
      refetchInterval: 30_000, // refresh every 30s
    },
  });

  if (!conditionData) return null;

  const condition = conditionData as [string, string, number, bigint, bigint];
  const [, feedAddr, comparator, threshold] = condition;

  // If no feed registered (address is zero), don't show
  if (feedAddr === "0x0000000000000000000000000000000000000000") return null;

  // Find feed info from our catalog
  const feedInfo = PRICE_FEEDS.find(
    (f) =>
      f.base.mainnet.toLowerCase() === feedAddr.toLowerCase() ||
      (f.base.sepolia && f.base.sepolia.toLowerCase() === feedAddr.toLowerCase())
  );

  const decimals = feedInfo?.decimals ?? 8;
  const symbol = feedInfo?.symbol ?? "???";
  const cmpLabel = COMPARATORS[comparator as ComparatorIndex] ?? "?";
  const thresholdNum = Number(threshold) / 10 ** decimals;

  // Preview data: [yesWon, priceObserved, updatedAt]
  let currentPrice: number | null = null;
  let yesWouldWin: boolean | null = null;
  let lastUpdated: number | null = null;

  if (previewData) {
    const preview = previewData as [boolean, bigint, bigint];
    yesWouldWin = preview[0];
    currentPrice = Number(preview[1]) / 10 ** decimals;
    lastUpdated = Number(preview[2]);
  }

  const fmtPrice = (n: number) =>
    n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: n >= 100 ? 0 : 2,
      maximumFractionDigits: n >= 100 ? 0 : 2,
    });

  const timeSinceUpdate = lastUpdated
    ? Math.floor(Date.now() / 1000) - lastUpdated
    : null;
  const freshnessLabel = timeSinceUpdate
    ? timeSinceUpdate < 60
      ? "just now"
      : timeSinceUpdate < 3600
      ? `${Math.floor(timeSinceUpdate / 60)}m ago`
      : `${Math.floor(timeSinceUpdate / 3600)}h ago`
    : null;

  return (
    <div
      className="mt-6 rounded-xl p-4"
      style={{
        background: "linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06))",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span className="text-xs font-semibold tracking-wider" style={{ color: "#a5b4fc" }}>
          CHAINLINK ORACLE · {symbol}/USD
        </span>
        {freshnessLabel && (
          <span className="ml-auto text-[10px] font-mono" style={{ color: "rgba(148,163,184,0.4)" }}>
            updated {freshnessLabel}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Current Price */}
        <div className="rounded-lg p-3" style={{ background: "rgba(10,10,30,0.5)" }}>
          <div className="text-[10px] font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
            CURRENT PRICE
          </div>
          <div className="mt-1 text-lg font-bold font-mono" style={{ color: "#e2e8f0" }}>
            {previewLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : currentPrice !== null ? (
              fmtPrice(currentPrice)
            ) : (
              "—"
            )}
          </div>
        </div>

        {/* Threshold */}
        <div className="rounded-lg p-3" style={{ background: "rgba(10,10,30,0.5)" }}>
          <div className="text-[10px] font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
            THRESHOLD ({cmpLabel.split(" ")[0].toUpperCase()})
          </div>
          <div className="mt-1 text-lg font-bold font-mono" style={{ color: "#e2e8f0" }}>
            {fmtPrice(thresholdNum)}
          </div>
        </div>
      </div>

      {/* Resolution preview */}
      {yesWouldWin !== null && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2"
          style={{
            background: yesWouldWin ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            border: `1px solid ${yesWouldWin ? "rgba(52,211,153,0.25)" : "rgba(248,113,113,0.25)"}`,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={yesWouldWin ? "#34d399" : "#f87171"}
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            {yesWouldWin ? (
              <path d="M20 6L9 17l-5-5" />
            ) : (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            )}
          </svg>
          <span
            className="text-xs font-semibold"
            style={{ color: yesWouldWin ? "#34d399" : "#f87171" }}
          >
            If resolved now: {yesWouldWin ? "YES wins" : "NO wins"}
          </span>
          <span className="ml-auto text-[10px] font-mono" style={{ color: "rgba(148,163,184,0.4)" }}>
            {symbol} {currentPrice !== null ? fmtPrice(currentPrice) : ""} {comparator === 0 ? ">" : comparator === 1 ? ">=" : comparator === 2 ? "<" : "<="} {fmtPrice(thresholdNum)}
          </span>
        </div>
      )}
    </div>
  );
}
