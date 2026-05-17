"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, habitStakingAbi } from "@/lib/contract";

export function CreateHabit({ onCreated }: { onCreated?: () => void }) {
  const { isConnected } = useAccount();
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("7");
  const [required, setRequired] = useState("5");
  const [stake, setStake] = useState("0.001");

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess && onCreated) {
    onCreated();
    reset();
  }

  const submit = () => {
    if (!description.trim()) return;
    const days = Number(duration);
    const req = Number(required);
    if (!Number.isInteger(days) || !Number.isInteger(req) || days <= 0 || req <= 0 || req > days) return;

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: habitStakingAbi,
      functionName: "createHabit",
      args: [description.trim(), days, req],
      value: parseEther(stake),
    });
  };

  const busy = isPending || isMining;

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-1">Create a new commitment</h2>
      <p className="text-sm text-white/50 mb-5">
        Your stake is locked in the contract until you complete or the deadline passes.
      </p>

      <div className="grid gap-4">
        <div>
          <label className="label">What do you commit to?</label>
          <input
            className="input"
            placeholder="e.g. Workout 30 minutes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={120}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duration (days)</label>
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Required check-ins</label>
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={required}
              onChange={(e) => setRequired(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="label">Stake (ETH)</label>
          <input
            className="input"
            type="number"
            step="0.0001"
            min={0}
            value={stake}
            onChange={(e) => setStake(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-white/40">
            Tip: start small on testnet (e.g. 0.001 ETH). The amount is whatever you find motivating to lose.
          </p>
        </div>

        <button
          onClick={submit}
          disabled={!isConnected || busy}
          className="btn-primary mt-2"
        >
          {!isConnected ? "Connect wallet first" : busy ? "Confirming…" : "Stake & start"}
        </button>

        {error && <p className="text-xs text-red-400 mt-1">{(error as Error).message}</p>}
        {isSuccess && <p className="text-xs text-emerald-400 mt-1">Habit created!</p>}
      </div>
    </section>
  );
}
