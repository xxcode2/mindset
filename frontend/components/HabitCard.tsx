"use client";

import { formatEther } from "viem";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, habitStakingAbi, type Habit } from "@/lib/contract";

const STATUS_LABEL = ["Active", "Completed", "Failed"] as const;
const STATUS_COLOR = [
  "bg-accent/15 text-accent border border-accent/30",
  "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  "bg-red-500/15 text-red-300 border border-red-500/30",
];

function fmtCountdown(endTs: number) {
  const diff = endTs - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ended";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((diff % 3600) / 60);
  return `${h}h ${m}m left`;
}

export function HabitCard({ habitId, onAction }: { habitId: bigint; onAction: () => void }) {
  const { data: habit, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: habitStakingAbi,
    functionName: "getHabit",
    args: [habitId],
  });

  const { data: canCheckIn } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: habitStakingAbi,
    functionName: "canCheckInToday",
    args: [habitId],
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    refetch();
    onAction();
  }

  if (!habit) return null;
  const h = habit as Habit;

  const endTs = Number(h.startTime) + h.durationDays * 86400;
  const isExpired = Math.floor(Date.now() / 1000) >= endTs;
  const targetMet = h.checkInsCount >= h.requiredCheckIns;
  const progress = Math.min(100, (h.checkInsCount / Math.max(1, h.requiredCheckIns)) * 100);

  const action = (fn: "checkIn" | "claim" | "forfeit") =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: habitStakingAbi,
      functionName: fn,
      args: [habitId],
    });

  const busy = isPending || isMining;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-white/40">#{habitId.toString()}</p>
          <h3 className="font-semibold text-base">{h.description}</h3>
        </div>
        <span className={`badge ${STATUS_COLOR[h.status]}`}>{STATUS_LABEL[h.status]}</span>
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm mb-4">
        <Stat label="Stake" value={`${formatEther(h.stake)} ETH`} />
        <Stat label="Progress" value={`${h.checkInsCount} / ${h.requiredCheckIns}`} />
        <Stat label="Time" value={h.status === 0 ? fmtCountdown(endTs) : `${h.durationDays}d`} />
      </div>

      <div className="h-2 rounded-full bg-white/5 overflow-hidden mb-5">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent2 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {h.status === 0 && !targetMet && !isExpired && (
          <button
            onClick={() => action("checkIn")}
            disabled={!canCheckIn || busy}
            className="btn-primary"
          >
            {busy ? "Checking in…" : canCheckIn ? "Check in today" : "Already checked in today"}
          </button>
        )}
        {h.status === 0 && targetMet && (
          <button onClick={() => action("claim")} disabled={busy} className="btn-primary">
            {busy ? "Claiming…" : `Claim ${formatEther(h.stake)} ETH`}
          </button>
        )}
        {h.status === 0 && isExpired && !targetMet && (
          <button onClick={() => action("forfeit")} disabled={busy} className="btn-secondary">
            {busy ? "Finalizing…" : "Finalize (forfeit to charity)"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-400">{(error as Error).message}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
