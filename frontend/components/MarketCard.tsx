"use client";

import { useState } from "react";
import { formatEther, parseEther } from "viem";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import {
  CONTRACT_ADDRESS,
  type Market,
  OUTCOME_LABEL,
  predictionMarketAbi,
} from "@/lib/contract";
import { bpsToPct, fmtAddr, fmtCountdown } from "@/lib/utils";

const OUTCOME_COLOR = [
  "bg-accent/15 text-accent border border-accent/30", // Unresolved
  "bg-yes/15 text-yes border border-yes/30", // YES
  "bg-no/15 text-no border border-no/30", // NO
  "bg-white/10 text-white/60 border border-white/15", // Invalid
];

export function MarketCard({ marketId }: { marketId: bigint }) {
  const { address } = useAccount();
  const [stake, setStake] = useState("0.001");

  const { data: market, refetch: refetchMarket } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "getMarket",
    args: [marketId],
  });

  const { data: yesBpsRaw } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "impliedYesBps",
    args: [marketId],
  });

  const userBatch = useReadContracts({
    contracts: address
      ? [
          {
            address: CONTRACT_ADDRESS,
            abi: predictionMarketAbi,
            functionName: "yesBets",
            args: [marketId, address],
          },
          {
            address: CONTRACT_ADDRESS,
            abi: predictionMarketAbi,
            functionName: "noBets",
            args: [marketId, address],
          },
          {
            address: CONTRACT_ADDRESS,
            abi: predictionMarketAbi,
            functionName: "hasClaimed",
            args: [marketId, address],
          },
        ]
      : [],
    query: { enabled: !!address },
  });

  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isMining, isSuccess } = useWaitForTransactionReceipt({ hash });

  if (isSuccess) {
    refetchMarket();
    userBatch.refetch();
    reset();
  }

  if (!market) {
    return <div className="card text-white/40 text-sm">Loading market #{marketId.toString()}…</div>;
  }

  const m = market as Market;
  const closeSec = Number(m.closeTime);
  const isClosed = Math.floor(Date.now() / 1000) >= closeSec;
  const isResolved = m.outcome !== 0;
  const total = m.yesPool + m.noPool;
  const yesPct = yesBpsRaw !== undefined ? Number(yesBpsRaw) / 100 : total > 0n ? Number((m.yesPool * 10000n) / total) / 100 : 50;

  const myYes = (userBatch.data?.[0]?.result as bigint | undefined) ?? 0n;
  const myNo = (userBatch.data?.[1]?.result as bigint | undefined) ?? 0n;
  const claimed = (userBatch.data?.[2]?.result as boolean | undefined) ?? false;

  const isWinner =
    (m.outcome === 1 && myYes > 0n) || (m.outcome === 2 && myNo > 0n);
  const canRefund = m.outcome === 3 && (myYes > 0n || myNo > 0n) && !claimed;
  const isResolver = address && address.toLowerCase() === m.resolver.toLowerCase();

  const placeBet = (yes: boolean) => {
    if (!stake || Number(stake) <= 0) return;
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "bet",
      args: [marketId, yes],
      value: parseEther(stake),
    });
  };
  const claimAction = () =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "claim",
      args: [marketId],
    });
  const refundAction = () =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "refund",
      args: [marketId],
    });
  const invalidateAction = () =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "markInvalid",
      args: [marketId],
    });
  const resolveAs = (yes: boolean) =>
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "resolve",
      args: [marketId, yes],
    });

  const busy = isPending || isMining;

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-xs text-white/40 mb-1">
            #{marketId.toString()} · by {fmtAddr(m.creator)} · resolver {fmtAddr(m.resolver)}
          </p>
          <h3 className="font-semibold text-base leading-snug break-words">{m.question}</h3>
        </div>
        <span className={`badge whitespace-nowrap ${OUTCOME_COLOR[m.outcome]}`}>
          {OUTCOME_LABEL[m.outcome]}
        </span>
      </div>

      <div className="h-2.5 rounded-full bg-no/20 overflow-hidden mb-2">
        <div className="h-full bg-yes transition-all" style={{ width: `${yesPct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-white/60 mb-4">
        <span className="text-yes">YES {yesPct.toFixed(1)}%</span>
        <span className="text-no">NO {(100 - yesPct).toFixed(1)}%</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-4">
        <Stat label="YES pool" value={`${formatEther(m.yesPool)} Ξ`} />
        <Stat label="NO pool" value={`${formatEther(m.noPool)} Ξ`} />
        <Stat label={isClosed ? "Status" : "Closes in"} value={fmtCountdown(closeSec)} />
      </div>

      {(myYes > 0n || myNo > 0n) && (
        <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 mb-4 text-xs">
          <span className="text-white/50">Your bets: </span>
          {myYes > 0n && <span className="text-yes mr-3">YES {formatEther(myYes)}Ξ</span>}
          {myNo > 0n && <span className="text-no">NO {formatEther(myNo)}Ξ</span>}
        </div>
      )}

      {/* Action area */}
      {!isClosed && !isResolved && (
        <div className="flex gap-2 items-center">
          <input
            className="input !py-2 flex-1"
            type="number"
            min={0}
            step="0.0001"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            placeholder="0.001"
          />
          <button onClick={() => placeBet(true)} disabled={busy} className="btn-yes">
            YES
          </button>
          <button onClick={() => placeBet(false)} disabled={busy} className="btn-no">
            NO
          </button>
        </div>
      )}

      {isClosed && !isResolved && isResolver && (
        <div className="flex gap-2">
          <button onClick={() => resolveAs(true)} disabled={busy} className="btn-yes flex-1">
            Resolve YES
          </button>
          <button onClick={() => resolveAs(false)} disabled={busy} className="btn-no flex-1">
            Resolve NO
          </button>
        </div>
      )}

      {isClosed && !isResolved && !isResolver && bpsCanInvalidate(closeSec) && (
        <button onClick={invalidateAction} disabled={busy} className="btn-secondary w-full">
          Grace expired — mark invalid
        </button>
      )}

      {isWinner && !claimed && (
        <button onClick={claimAction} disabled={busy} className="btn-primary w-full">
          {busy ? "Claiming…" : "Claim winnings"}
        </button>
      )}

      {canRefund && (
        <button onClick={refundAction} disabled={busy} className="btn-secondary w-full">
          {busy ? "Refunding…" : "Refund stake"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-400 break-words">{(error as Error).message}</p>}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="font-medium font-mono">{value}</p>
    </div>
  );
}

function bpsCanInvalidate(closeSec: number): boolean {
  return Math.floor(Date.now() / 1000) >= closeSec + 7 * 24 * 3600;
}
