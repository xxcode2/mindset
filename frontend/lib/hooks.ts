"use client";

import { useReadContract, useReadContracts } from "wagmi";
import { CONTRACT_ADDRESS, predictionMarketAbi, type Market } from "./contract";

/** Total number of markets ever created. */
export function useMarketCount() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "nextMarketId",
  });
}

/**
 * Markets, newest first.
 * Pass `limit` to only fetch the most recent N (recommended for `/markets` listing).
 * Defaults to fetching all (legacy behavior).
 */
export function useAllMarkets(limit?: number) {
  const { data: countRaw, isLoading: loadingCount } = useMarketCount();
  const total = countRaw ? Number(countRaw as bigint) : 0;

  const fetchCount = limit !== undefined ? Math.min(limit, total) : total;
  const ids =
    fetchCount === 0
      ? []
      : Array.from({ length: fetchCount }, (_, i) => BigInt(total - 1 - i));

  const batch = useReadContracts({
    allowFailure: false,
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: predictionMarketAbi,
      functionName: "getMarket" as const,
      args: [id] as const,
    })),
    query: { enabled: fetchCount > 0 },
  });

  const markets = (batch.data as Market[] | undefined) ?? [];
  return {
    ids,
    total,
    markets: markets.map((m, i) => ({ id: ids[i], market: m })),
    isLoading: loadingCount || batch.isLoading,
    refetch: batch.refetch,
  };
}

/** Single market view. */
export function useMarket(marketId: bigint | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "getMarket",
    args: marketId !== undefined ? [marketId] : undefined,
    query: { enabled: marketId !== undefined },
  });
}
