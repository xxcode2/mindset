"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import { CONTRACT_ADDRESS, predictionMarketAbi } from "@/lib/contract";
import { pushToast } from "@/lib/toast";

export default function CreatePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [question, setQuestion] = useState("");
  const [description, setDescription] = useState("");
  const [closesIn, setClosesIn] = useState("24"); // hours
  const [resolver, setResolver] = useState("");

  const create = useWriteContract();
  const mined = useWaitForTransactionReceipt({ hash: create.data });

  useEffect(() => {
    if (mined.isSuccess) {
      pushToast("Market created!", "success");
      // Reset and go back to market list.
      setQuestion("");
      setDescription("");
      create.reset();
      setTimeout(() => router.push("/markets"), 600);
    }
  }, [mined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (create.error) pushToast(create.error.message ?? "Transaction failed", "error");
  }, [create.error]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) return pushToast("Connect your wallet first", "error");
    const q = question.trim();
    if (q.length === 0 || q.length > 280) return pushToast("Question is required (max 280 chars)", "error");
    const hours = Number(closesIn);
    if (!Number.isFinite(hours) || hours <= 0) return pushToast("Invalid duration", "error");

    const resolverAddr = (resolver.trim() || address) as `0x${string}`;
    if (!/^0x[a-fA-F0-9]{40}$/.test(resolverAddr)) return pushToast("Invalid resolver address", "error");

    const closeTime = BigInt(Math.floor(Date.now() / 1000) + Math.round(hours * 3600));

    create.writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "createMarket",
      args: [q, description.trim(), closeTime, resolverAddr, 0], // 0 = Custom category
    });
  };

  const busy = create.isPending || mined.isLoading;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h2 className="mb-2 text-3xl font-bold" style={{ color: "#f1f5f9" }}>
          Create Market
        </h2>
        <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
          Launch a new YES/NO prediction market on Base.
        </p>
      </div>

      {!isConnected && (
        <div className="glass-card mb-6 p-6 text-center">
          <p className="mb-3 text-sm" style={{ color: "rgba(148,163,184,0.7)" }}>
            Connect your wallet to create a market.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      )}

      <form onSubmit={submit} className="glass-card p-6 sm:p-8">
        <div className="space-y-6">
          <Field
            label="MARKET QUESTION"
            hint={`${question.length}/280`}
          >
            <input
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={280}
              placeholder="Will BTC exceed $100,000 before June 2026?"
              className="input-field rounded-xl px-4 py-3 text-sm"
            />
          </Field>

          <Field label="DESCRIPTION (optional)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Provide context and resolution criteria. e.g. resolves YES if BTC closes above $100k on Coinbase by 23:59 UTC."
              className="input-field resize-none rounded-xl px-4 py-3 text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="CLOSES IN (HOURS)">
              <input
                type="number"
                required
                min={1}
                value={closesIn}
                onChange={(e) => setClosesIn(e.target.value)}
                className="input-field rounded-xl px-4 py-3 font-mono text-sm"
              />
            </Field>
            <Field label="RESOLVER ADDRESS">
              <input
                type="text"
                value={resolver}
                onChange={(e) => setResolver(e.target.value)}
                placeholder={address ?? "0x…"}
                className="input-field rounded-xl px-4 py-3 font-mono text-xs"
              />
            </Field>
          </div>
          <p className="-mt-4 text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
            The resolver decides YES or NO after close. Defaults to your address. Use a multisig or oracle bot for serious markets.
          </p>

          <div className="info-pill flex items-start gap-3 rounded-xl p-4">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <div>
              <div className="mb-1 text-xs font-semibold" style={{ color: "#a5b4fc" }}>
                Non-custodial market
              </div>
              <div className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.6)" }}>
                Bets are held by the smart contract, not by you. If the resolver fails to settle within 7 days of close, anyone can mark the market invalid and bettors get full refunds.
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy || !isConnected}
            className="btn-primary w-full rounded-xl py-3.5 text-base font-semibold"
          >
            {busy ? "Confirming…" : "Create Market"}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="block text-xs font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
          {label}
        </label>
        {hint && (
          <span className="text-xs font-mono" style={{ color: "rgba(148,163,184,0.35)" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
