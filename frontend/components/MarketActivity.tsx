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

/** Lists recent BetPlaced events for a single market. */
export function MarketActivity({ marketId }: { marketId: bigint }) {
  const client = usePublicClient();
  const [activity, setActivity] = useState<Activity[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!client) return;
    (async () => {
      try {
        const block = await client.getBlockNumber();
        // Look back ~50k blocks (~24h on Base) to keep RPC light.
        const fromBlock = block > 50_000n ? block - 50_000n : 0n;
        const logs = await client.getLogs({
          address: CONTRACT_ADDRESS,
          event: {
            type: "event",
            name: "BetPlaced",
            inputs: [
              { name: "marketId", type: "uint256", indexed: true },
              { name: "bettor", type: "address", indexed: true },
              { name: "yes", type: "bool", indexed: false },
              { name: "amount", type: "uint256", indexed: false },
              { name: "newYesPool", type: "uint128", indexed: false },
              { name: "newNoPool", type: "uint128", indexed: false },
            ],
          },
          args: { marketId },
          fromBlock,
          toBlock: "latest",
        });
        if (cancelled) return;
        const items = (logs as Log[])
          .map((l) => {
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
          })
          .sort((a, b) =>
            a.blockNumber === b.blockNumber
              ? b.logIndex - a.logIndex
              : Number(b.blockNumber - a.blockNumber)
          )
          .slice(0, 12);
        setActivity(items);
      } catch (e) {
        console.error("activity fetch failed", e);
        setActivity([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, marketId]);

  if (activity === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
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
