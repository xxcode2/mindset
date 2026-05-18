"use client";

import { useEffect, useState } from "react";
import { decodeEventLog, type Log } from "viem";
import { usePublicClient } from "wagmi";
import { CONTRACT_ADDRESS, predictionMarketAbi } from "@/lib/contract";
import { fmtAddr, fmtToken } from "@/lib/utils";

type Activity = {
  blockNumber: bigint;
  logIndex: number;
  bettor: `0x${string}`;
  yes: boolean;
  amount: bigint;
};

const BET_PLACED_EVENT = {
  type: "event" as const,
  name: "BetPlaced" as const,
  inputs: [
    { name: "marketId", type: "uint256" as const, indexed: true },
    { name: "bettor", type: "address" as const, indexed: true },
    { name: "yes", type: "bool" as const, indexed: false },
    { name: "amount", type: "uint256" as const, indexed: false },
    { name: "newYesPool", type: "uint128" as const, indexed: false },
    { name: "newNoPool", type: "uint128" as const, indexed: false },
  ],
};

/**
 * Fetches logs in chunks to work around RPC range limits.
 * Starts from the largest range and falls back to smaller chunks if the RPC rejects.
 */
async function fetchLogsChunked(
  client: any,
  marketId: bigint,
  latestBlock: bigint,
): Promise<Log[]> {
  // Try progressively smaller ranges: all history → 100k → 50k → 10k
  const ranges = [latestBlock, 100_000n, 50_000n, 10_000n];

  for (const range of ranges) {
    const fromBlock = latestBlock > range ? latestBlock - range : 0n;
    try {
      const logs = await client.getLogs({
        address: CONTRACT_ADDRESS,
        event: BET_PLACED_EVENT,
        args: { marketId },
        fromBlock,
        toBlock: "latest",
      });
      return logs as Log[];
    } catch (e: any) {
      // If the error is about range being too large, try smaller range
      const msg = e?.message?.toLowerCase() ?? "";
      if (
        msg.includes("range") ||
        msg.includes("block") ||
        msg.includes("limit") ||
        msg.includes("timeout") ||
        msg.includes("exceed")
      ) {
        continue;
      }
      // Unknown error — don't retry, throw
      throw e;
    }
  }

  // All ranges failed — return empty
  return [];
}

/** Lists recent BetPlaced events for a single market. Refetches when refreshKey changes. */
export function MarketActivity({ marketId, refreshKey = 0 }: { marketId: bigint; refreshKey?: number }) {
  const client = usePublicClient();
  const [activity, setActivity] = useState<Activity[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!client) return;
    (async () => {
      try {
        setError(false);
        const block = await client.getBlockNumber();
        const logs = await fetchLogsChunked(client, marketId, block);
        if (cancelled) return;
        const items = logs
          .map((l) => {
            try {
              const decoded = decodeEventLog({
                abi: predictionMarketAbi,
                data: l.data,
                topics: l.topics,
              });
              const a = decoded.args as any;
              return {
                blockNumber: l.blockNumber!,
                logIndex: l.logIndex!,
                bettor: a.bettor as `0x${string}`,
                yes: a.yes as boolean,
                amount: a.amount as bigint,
              };
            } catch {
              return null;
            }
          })
          .filter((x): x is Activity => x !== null)
          .sort((a, b) =>
            a.blockNumber === b.blockNumber
              ? b.logIndex - a.logIndex
              : Number(b.blockNumber - a.blockNumber)
          )
          .slice(0, 20);
        setActivity(items);
      } catch (e) {
        console.error("activity fetch failed", e);
        if (!cancelled) {
          setError(true);
          setActivity([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, marketId, refreshKey]);

  if (activity === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    );
  }

  if (error && activity.length === 0) {
    return (
      <p className="text-sm" style={{ color: "rgba(248,113,113,0.7)" }}>
        Failed to load activity. The RPC may be rate-limited — try refreshing.
      </p>
    );
  }

  if (activity.length === 0) {
    return (
      <p className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>
        No recent bets on this market yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {activity.map((a) => (
        <div
          key={`${a.blockNumber}-${a.logIndex}`}
          className="flex items-center gap-3 rounded-xl p-3"
          style={{ background: "rgba(10,10,30,0.4)", border: "1px solid rgba(99,102,241,0.05)" }}
        >
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
            style={{ background: a.yes ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)" }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={a.yes ? "#34d399" : "#f87171"}
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              {a.yes ? <path d="M20 6L9 17l-5-5" /> : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              )}
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium" style={{ color: "#cbd5e1" }}>
              <span className="font-mono">{fmtAddr(a.bettor)}</span> bet on{" "}
              <span style={{ color: a.yes ? "#34d399" : "#f87171" }}>{a.yes ? "YES" : "NO"}</span>
            </div>
            <div className="text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
              {fmtToken(a.amount)}
            </div>
          </div>
          <div className="text-xs font-mono" style={{ color: "rgba(148,163,184,0.35)" }}>
            #{a.blockNumber.toString()}
          </div>
        </div>
      ))}
    </div>
  );
}
