"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useReadContract, useReadContracts, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  TOKEN_SYMBOL,
  TOKEN_DECIMALS,
  erc20Abi,
  predictionMarketAbi,
  type Market,
} from "@/lib/contract";
import { fmtToken, parseToken, classNames } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

// Minimum bet: 1 token (e.g. 1 USDC)
const MIN_BET = BigInt(10 ** TOKEN_DECIMALS); // 1_000_000 for 6 decimals

/**
 * Maps common contract revert error names to user-friendly messages.
 */
function friendlyError(error: Error | null): string {
  if (!error) return "";
  const msg = error.message ?? "";

  // Match custom error names from the contract
  const errorMap: Record<string, string> = {
    ZeroBet: "Bet amount must be greater than zero.",
    MarketNotOpen: "This market is no longer accepting bets.",
    TransferFailed: "Token transfer failed. Check your balance and approval.",
    InsufficientBalance: "You don't have enough tokens.",
    InsufficientAllowance: "Token approval insufficient. Please approve first.",
    MarketNotClosed: "Market hasn't closed yet.",
    MarketAlreadyResolved: "This market has already been resolved.",
    NotResolver: "Only the designated resolver can resolve this market.",
    AlreadyClaimed: "You've already claimed from this market.",
    NothingToClaim: "No winnings to claim for your position.",
    InvalidOutcome: "Cannot claim — market was invalidated. Use refund instead.",
    CreationFeeFailed: "Creation fee payment failed. Check your balance.",
    UserRejected: "Transaction was rejected.",
  };

  for (const [key, friendly] of Object.entries(errorMap)) {
    if (msg.includes(key)) return friendly;
  }

  // Common wallet errors
  if (msg.includes("User rejected") || msg.includes("user rejected") || msg.includes("denied")) {
    return "Transaction cancelled by user.";
  }
  if (msg.includes("insufficient funds")) {
    return "Not enough ETH for gas fees.";
  }

  // Fallback: truncate long messages
  const clean = msg.replace(/^Error: /, "").split("\n")[0];
  return clean.length > 120 ? clean.slice(0, 117) + "…" : clean;
}

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
  const pendingBetAfterApprove = useRef(false);

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

  // Read user's existing bets on this market (for opposite-side warning)
  const existingBets = useReadContracts({
    contracts:
      address && marketId !== undefined
        ? [
            {
              address: CONTRACT_ADDRESS,
              abi: predictionMarketAbi,
              functionName: "yesBets" as const,
              args: [marketId, address] as const,
            },
            {
              address: CONTRACT_ADDRESS,
              abi: predictionMarketAbi,
              functionName: "noBets" as const,
              args: [marketId, address] as const,
            },
          ]
        : [],
    query: { enabled: !!address && marketId !== undefined },
  });

  const existingYes = (existingBets.data?.[0]?.result as bigint | undefined) ?? 0n;
  const existingNo = (existingBets.data?.[1]?.result as bigint | undefined) ?? 0n;
  const bettingOppositeSide =
    (side === "yes" && existingNo > 0n && existingYes === 0n) ||
    (side === "no" && existingYes > 0n && existingNo === 0n);

  // TX state
  const approveTx = useWriteContract();
  const betTx = useWriteContract();

  const approveMined = useWaitForTransactionReceipt({ hash: approveTx.data });
  const betMined = useWaitForTransactionReceipt({ hash: betTx.data });

  // After approve succeeds → auto-trigger the bet
  useEffect(() => {
    if (approveMined.isSuccess) {
      pushToast("Approval confirmed! Placing bet…", "success");
      approveTx.reset();
      refetchAllowance();
      pendingBetAfterApprove.current = true;
    }
  }, [approveMined.isSuccess]); // eslint-disable-line

  // Once allowance is refreshed after approve, auto-send bet tx
  useEffect(() => {
    if (pendingBetAfterApprove.current && amount > 0n && allowance >= amount) {
      pendingBetAfterApprove.current = false;
      betTx.writeContract({
        address: CONTRACT_ADDRESS,
        abi: predictionMarketAbi,
        functionName: "bet",
        args: [marketId, side === "yes", amount],
      });
    }
  }, [allowance, amount]); // eslint-disable-line

  useEffect(() => {
    if (betMined.isSuccess) {
      pushToast(`Bet placed on ${side.toUpperCase()}!`, "success");
      setInput("");
      betTx.reset();
      existingBets.refetch();
      onPlaced();
    }
  }, [betMined.isSuccess]); // eslint-disable-line

  const submit = () => {
    if (!isConnected) return pushToast("Connect your wallet first", "error");
    if (amount <= 0n) return pushToast("Enter a positive amount", "error");
    if (amount < MIN_BET) return pushToast(`Minimum bet is 1 ${TOKEN_SYMBOL}`, "error");
    if (balance !== undefined && (balance as bigint) < amount) {
      return pushToast("Insufficient token balance", "error");
    }
    if (needsApproval) {
      pendingBetAfterApprove.current = true;
      approveTx.writeContract({
        address: TOKEN_ADDRESS,
        abi: erc20Abi,
        functionName: "approve",
        args: [CONTRACT_ADDRESS, 2n ** 256n - 1n],
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
    : busy && (approveTx.isPending || approveMined.isLoading)
    ? "Approving → will auto-bet…"
    : busy
    ? "Confirming…"
    : needsApproval
    ? `Approve & Bet (2 steps)`
    : "Place Bet";

  const txError = approveTx.error ?? betTx.error;

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

      {/* Warning: betting opposite side */}
      {bettingOppositeSide && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-xs"
          style={{
            background: "rgba(251,191,36,0.08)",
            border: "1px solid rgba(251,191,36,0.25)",
            color: "#fcd34d",
          }}
        >
          <div className="flex items-start gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <span className="font-semibold">You already bet on the other side.</span>
              <span className="mt-0.5 block" style={{ color: "rgba(253,230,138,0.75)" }}>
                If {side === "yes" ? "YES" : "NO"} wins, your {side === "yes" ? "NO" : "YES"} stake will be lost. Only the winning side pays out.
              </span>
            </div>
          </div>
        </div>
      )}

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
        <div className="mt-2 flex items-center justify-between">
          {balance !== undefined && (
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
              Balance: {fmtToken(balance as bigint)}
            </p>
          )}
          <p className="text-xs" style={{ color: "rgba(148,163,184,0.3)" }}>
            Min: 1 {TOKEN_SYMBOL}
          </p>
        </div>
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

      {txError && (
        <div
          className="mt-3 rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)", color: "#fca5a5" }}
        >
          {friendlyError(txError)}
        </div>
      )}
    </div>
  );
}
