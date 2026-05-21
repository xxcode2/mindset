"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
  erc20Abi,
  predictionMarketAbi,
  type Market,
} from "@/lib/contract";
import { fmtToken, parseToken, classNames } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

export function BetPanel({
  marketId,
  market,
  onPlaced,
}: {
  marketId: bigint;
  market: Market;
  onPlaced: () => void;
}) {
  const { address, isConnected } = useAccount();
  const [side, setSide] = useState<"yes" | "no">("yes");
  const [input, setInput] = useState("");

  const closed = Date.now() / 1000 >= Number(market.closeTime) || market.outcome !== 0;
  const amount = parseToken(input);

  // Read user's token balance + allowance.
  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: address ? [address, CONTRACT_ADDRESS] : undefined,
    query: { enabled: !!address },
  });
  const allowance = (allowanceData as bigint | undefined) ?? 0n;
  const needsApproval = amount > 0n && allowance < amount;

  // TX state
  const approveTx = useWriteContract();
  const betTx = useWriteContract();

  const approveMined = useWaitForTransactionReceipt({ hash: approveTx.data });
  const betMined = useWaitForTransactionReceipt({ hash: betTx.data });

  useEffect(() => {
    if (approveMined.isSuccess) {
      pushToast("Approval confirmed", "success");
      refetchAllowance();
      approveTx.reset();
    }
  }, [approveMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (betMined.isSuccess) {
      pushToast(`Bet placed on ${side.toUpperCase()}`, "success");
      setInput("");
      betTx.reset();
      onPlaced();
    }
  }, [betMined.isSuccess]); // eslint-disable-line

  const submit = () => {
    if (!isConnected) return pushToast("Connect your wallet first", "error");
    if (amount <= 0n) return pushToast("Enter a positive amount", "error");
    if (balance !== undefined && (balance as bigint) < amount) {
      return pushToast("Insufficient token balance", "error");
    }
    if (needsApproval) {
      approveTx.writeContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, amount],
      });
      return;
    }
    betTx.writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "bet",
      args: [marketId, side === "yes", amount],
    });
  };

  const busy =
    approveTx.isPending ||
    approveMined.isLoading ||
    betTx.isPending ||
    betMined.isLoading;

  const buttonLabel = closed
    ? "Market closed"
    : !isConnected
    ? "Connect wallet"
    : busy && needsApproval
    ? "Approving…"
    : busy
    ? "Confirming…"
    : needsApproval
    ? `Approve ${TOKEN_SYMBOL}`
    : "Place Bet";

  return (
    <div className="glass-card p-6 sm:p-8" style={{ position: "sticky", top: 80 }}>
      <h3 className="mb-6 text-lg font-semibold" style={{ color: "#f1f5f9" }}>
        Place {side === "yes" ? "YES" : "NO"} bet
      </h3>

      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          disabled={closed}
          onClick={() => setSide("yes")}
          className={classNames(
            "toggle-btn rounded-xl py-3 text-sm font-semibold",
            side === "yes" && "active-yes"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            YES
          </span>
        </button>
        <button
          disabled={closed}
          onClick={() => setSide("no")}
          className={classNames(
            "toggle-btn rounded-xl py-3 text-sm font-semibold",
            side === "no" && "active-no"
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            NO
          </span>
        </button>
      </div>

      <div className="mb-4">
        <label
          htmlFor="bet-amount"
          className="mb-2 block text-xs font-medium tracking-wider"
          style={{ color: "rgba(148,163,184,0.5)" }}
        >
          BET AMOUNT ({TOKEN_SYMBOL})
        </label>
        <div className="relative">
          <input
            id="bet-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={closed}
            className="input-field w-full rounded-xl px-4 py-3 font-mono text-base"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1">
            {["10", "100", "1000"].map((v) => (
              <button
                key={v}
                disabled={closed}
                onClick={() => setInput(v)}
                className="rounded-lg px-2 py-1 text-xs font-medium"
                style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8" }}
              >
                {Number(v) >= 1000 ? "1K" : v}
              </button>
            ))}
          </div>
        </div>
        {balance !== undefined && (
          <p className="mt-2 text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
            Balance: {fmtToken(balance as bigint)}
          </p>
        )}
      </div>

      <div className="info-pill mb-6 flex items-start gap-3 rounded-xl p-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <div>
          <div className="text-xs font-semibold" style={{ color: "#a5b4fc" }}>
            Funds held by smart contract
          </div>
          <div className="mt-1 text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>
            Non-custodial. Stake locked until resolution. 5% fee applied to losing pool only.
          </div>
        </div>
      </div>

      <button
        onClick={submit}
        disabled={busy || closed}
        className="btn-primary w-full rounded-xl py-3.5 text-base font-semibold"
      >
        {buttonLabel}
      </button>

      <p className="mt-3 text-xs" style={{ color: "rgba(148,163,184,0.35)" }}>
        Gas fees apply · Non-reversible
      </p>

      {(approveTx.error || betTx.error) && (
        <p className="mt-3 break-words text-xs text-red-400">
          {(approveTx.error ?? betTx.error)?.message}
        </p>
      )}
    </div>
  );
}
