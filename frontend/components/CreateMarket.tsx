"use client";

import { useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESS, predictionMarketAbi } from "@/lib/contract";

export function CreateMarket({ onCreated }: { onCreated?: () => void }) {
  const { address, isConnected } = useAccount();
  const [question, setQuestion] = useState("");
  const [hours, setHours] = useState("24");
  const [resolver, setResolver] = useState("");

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess && onCreated) {
    onCreated();
    setQuestion("");
    reset();
  }

  const submit = () => {
    if (!question.trim()) return;
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0) return;
    const closeTime = BigInt(Math.floor(Date.now() / 1000) + h * 3600);
    const resolverAddr = (resolver || address || "") as `0x${string}`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(resolverAddr)) return;

    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "createMarket",
      args: [question.trim(), closeTime, resolverAddr],
    });
  };

  const busy = isPending || isMining;

  return (
    <section className="card">
      <h2 className="text-lg font-semibold mb-1">Create a market</h2>
      <p className="text-sm text-white/50 mb-5">
        The resolver decides YES or NO after the close time. Bettors are protected: if no
        resolution within 7 days of close, anyone can mark the market invalid and bettors get
        a full refund.
      </p>

      <div className="grid gap-4">
        <div>
          <label className="label">Question (yes/no)</label>
          <input
            className="input"
            placeholder="Will BTC close above $200k by Dec 31, 2026?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={280}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Closes in (hours)</label>
            <input
              className="input"
              type="number"
              min={1}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Resolver address</label>
            <input
              className="input font-mono text-xs"
              placeholder={address ?? "0x..."}
              value={resolver}
              onChange={(e) => setResolver(e.target.value)}
            />
          </div>
        </div>
        <p className="text-xs text-white/40 -mt-2">
          Defaults to your address. Use a multisig or oracle bot for serious markets.
        </p>

        <button onClick={submit} disabled={!isConnected || busy} className="btn-primary mt-1">
          {!isConnected ? "Connect wallet first" : busy ? "Confirming…" : "Create market"}
        </button>
        {error && <p className="text-xs text-red-400">{(error as Error).message}</p>}
        {isSuccess && <p className="text-xs text-emerald-400">Market created!</p>}
      </div>
    </section>
  );
}
