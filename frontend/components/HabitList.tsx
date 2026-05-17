"use client";

import { useAccount, useReadContract } from "wagmi";
import { CONTRACT_ADDRESS, habitStakingAbi } from "@/lib/contract";
import { HabitCard } from "./HabitCard";

export function HabitList({ refreshKey, onAction }: { refreshKey: number; onAction: () => void }) {
  const { address, isConnected } = useAccount();

  const { data: ids, isLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: habitStakingAbi,
    functionName: "getUserHabits",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 0 },
    scopeKey: `habits-${refreshKey}`,
  });

  if (!isConnected) {
    return (
      <div className="card text-center text-white/50">
        Connect your wallet to see your habits.
      </div>
    );
  }

  if (isLoading) {
    return <div className="card text-white/50">Loading…</div>;
  }

  const list = (ids as bigint[] | undefined) ?? [];

  if (list.length === 0) {
    return (
      <div className="card text-center text-white/50">
        No habits yet. Create your first commitment above.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[...list].reverse().map((id) => (
        <HabitCard key={id.toString()} habitId={id} onAction={onAction} />
      ))}
    </div>
  );
}
