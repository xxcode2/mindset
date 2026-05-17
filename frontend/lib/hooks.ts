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

/** All markets, newest first. Uses one batched RPC call. */
export function useAllMarkets() {
  const { data: countRaw, isLoading: loadingCount } = useMarketCount();
  const total = countRaw ? Number(countRaw as bigint) : 0;

  const ids = total === 0 ? [] : Array.from({ length: total }, (_, i) => BigInt(total - 1 - i));

  const batch = useReadContracts({
    allowFailure: false,
    contracts: ids.map((id) => ({
      address: CONTRACT_ADDRESS as `0x${string}`,
      abi: predictionMarketAbi,
      functionName: "getMarket" as const,
      args: [id] as const,
    })),
    query: { enabled: total > 0 },
  });

  const markets = (batch.data as Market[] | undefined) ?? [];
  return {
    ids,
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
