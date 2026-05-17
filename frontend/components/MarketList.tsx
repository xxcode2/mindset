"use client";

import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, predictionMarketAbi } from "@/lib/contract";
import { MarketCard } from "./MarketCard";

export function MarketList({ refreshKey }: { refreshKey: number }) {
  const { data: count, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "nextMarketId",
    scopeKey: `markets-${refreshKey}`,
  });

  if (isLoading) return <div className="card text-white/50">Loading markets…</div>;

  const total = count ? Number(count as bigint) : 0;
  if (total === 0) {
    return (
      <div className="card text-center text-white/50">
        No markets yet. Create the first one!
      </div>
    );
  }

  // Newest first
  const ids = Array.from({ length: total }, (_, i) => BigInt(total - 1 - i));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {ids.map((id) => (
        <MarketCard key={id.toString()} marketId={id} />
      ))}
    </div>
  );
}
