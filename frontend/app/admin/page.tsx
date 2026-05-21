"use client";

import { useEffect, useState } from "react";
import {
  useAccount,
  useReadContract,
  useReadContracts,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ConnectButton } from "@/components/ConnectButton";
import {
  CONTRACT_ADDRESS,
  TOKEN_ADDRESS,
  predictionMarketAbi,
  erc20Abi,
} from "@/lib/contract";
import { fmtAddr, fmtToken } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

export default function AdminPage() {
  const { address, isConnected } = useAccount();

  // Read contract config
  const configBatch = useReadContracts({
    contracts: [
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "owner" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "feeRecipient" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "creationFee" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "resolverBond" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "REVIEW_PERIOD" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "RESOLUTION_GRACE_PERIOD" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "nextMarketId" as const },
      { address: CONTRACT_ADDRESS, abi: predictionMarketAbi, functionName: "bettingToken" as const },
    ],
  });

  const ownerAddr = configBatch.data?.[0]?.result as `0x${string}` | undefined;
  const feeRecipient = configBatch.data?.[1]?.result as `0x${string}` | undefined;
  const creationFee = (configBatch.data?.[2]?.result as bigint | undefined) ?? 0n;
  const resolverBond = (configBatch.data?.[3]?.result as bigint | undefined) ?? 0n;
  const reviewPeriod = (configBatch.data?.[4]?.result as bigint | undefined) ?? 0n;
  const gracePeriod = (configBatch.data?.[5]?.result as bigint | undefined) ?? 0n;
  const totalMarkets = (configBatch.data?.[6]?.result as bigint | undefined) ?? 0n;
  const bettingToken = configBatch.data?.[7]?.result as `0x${string}` | undefined;

  const isOwner =
    !!address && !!ownerAddr && address.toLowerCase() === ownerAddr.toLowerCase();

  // Transfer ownership form
  const [newOwner, setNewOwner] = useState("");
  const transferTx = useWriteContract();
  const transferMined = useWaitForTransactionReceipt({ hash: transferTx.data });

  // Set trusted resolver form
  const [resolverAddr, setResolverAddr] = useState("");
  const [resolverTrusted, setResolverTrusted] = useState(true);
  const resolverTx = useWriteContract();
  const resolverMined = useWaitForTransactionReceipt({ hash: resolverTx.data });

  // Check trusted resolver
  const [checkAddr, setCheckAddr] = useState("");
  const isValidCheckAddr = /^0x[a-fA-F0-9]{40}$/.test(checkAddr);
  const { data: isTrusted, refetch: refetchTrusted } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: predictionMarketAbi,
    functionName: "trustedResolver",
    args: isValidCheckAddr ? [checkAddr as `0x${string}`] : undefined,
    query: { enabled: isValidCheckAddr },
  });

  useEffect(() => {
    if (transferMined.isSuccess) {
      pushToast("Ownership transferred!", "success");
      transferTx.reset();
      setNewOwner("");
      configBatch.refetch();
    }
  }, [transferMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (resolverMined.isSuccess) {
      pushToast(`Resolver ${resolverTrusted ? "trusted" : "untrusted"} successfully`, "success");
      resolverTx.reset();
      setResolverAddr("");
      refetchTrusted();
    }
  }, [resolverMined.isSuccess]); // eslint-disable-line

  if (!isConnected) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="glass-card p-12">
          <h2 className="mb-3 text-2xl font-bold" style={{ color: "#f1f5f9" }}>
            Admin Panel
          </h2>
          <p className="mb-6 text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            Connect the owner wallet to access admin controls.
          </p>
          <div className="flex justify-center">
            <ConnectButton />
          </div>
        </div>
      </section>
    );
  }

  if (!isOwner) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <div className="glass-card p-12">
          <div
            className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.3)" }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h2 className="mb-3 text-2xl font-bold" style={{ color: "#f1f5f9" }}>
            Access Denied
          </h2>
          <p className="mb-2 text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
            This page is only accessible to the contract owner.
          </p>
          <p className="text-xs font-mono" style={{ color: "rgba(148,163,184,0.4)" }}>
            Owner: {fmtAddr(ownerAddr, 8, 6)}
          </p>
          <p className="mt-1 text-xs font-mono" style={{ color: "rgba(148,163,184,0.4)" }}>
            Your wallet: {fmtAddr(address, 8, 6)}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-bold" style={{ color: "#f1f5f9" }}>
              Admin Panel
            </h2>
            <p className="text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
              Contract owner controls — manage resolvers and ownership
            </p>
          </div>
        </div>
      </div>

      {/* Contract Info */}
      <div className="glass-card mb-8 p-6">
        <h3 className="mb-4 text-base font-semibold" style={{ color: "#e2e8f0" }}>
          Contract Configuration (Immutable)
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoItem label="Contract" value={fmtAddr(CONTRACT_ADDRESS, 8, 6)} mono />
          <InfoItem label="Owner (you)" value={fmtAddr(ownerAddr, 8, 6)} mono />
          <InfoItem label="Fee Recipient" value={fmtAddr(feeRecipient, 8, 6)} mono />
          <InfoItem label="Betting Token" value={fmtAddr(bettingToken, 8, 6)} mono />
          <InfoItem label="Creation Fee" value={fmtToken(creationFee)} />
          <InfoItem label="Resolver Bond" value={fmtToken(resolverBond)} />
          <InfoItem label="Review Period" value={`${Number(reviewPeriod) / 86400} days`} />
          <InfoItem label="Grace Period" value={`${Number(gracePeriod) / 86400} days`} />
          <InfoItem label="Total Markets" value={totalMarkets.toString()} />
        </div>
      </div>

      {/* Owner Capabilities Explainer */}
      <div
        className="glass-card mb-8 p-6"
        style={{ border: "1px solid rgba(251,191,36,0.2)" }}
      >
        <h3 className="mb-3 text-base font-semibold" style={{ color: "#fde68a" }}>
          Owner Capabilities
        </h3>
        <ul className="space-y-2 text-sm" style={{ color: "rgba(253,230,138,0.8)" }}>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span><strong>Approve/Reject</strong> outcome proposals from non-trusted resolvers (during review window)</span>
          </li>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span><strong>Set Trusted Resolver</strong> — mark/unmark resolver contracts as trusted (instant finalization, no bond)</span>
          </li>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            <span><strong>Transfer Ownership</strong> — hand over admin role to a new address</span>
          </li>
          <li className="flex items-start gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 flex-shrink-0">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span style={{ color: "rgba(248,113,113,0.8)" }}><strong>Cannot</strong> move user funds, change fees, upgrade contract, or pause betting</span>
          </li>
        </ul>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Trusted Resolver Management */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-base font-semibold" style={{ color: "#e2e8f0" }}>
            Manage Trusted Resolvers
          </h3>
          <p className="mb-4 text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
            Trusted resolvers finalize markets instantly without bond or review. Only use for audited oracle contracts.
          </p>

          {/* Check resolver status */}
          <div className="mb-6">
            <label className="mb-2 block text-xs font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
              CHECK RESOLVER STATUS
            </label>
            <input
              type="text"
              placeholder="0x... resolver address"
              value={checkAddr}
              onChange={(e) => setCheckAddr(e.target.value)}
              className="input-field w-full rounded-xl px-4 py-2.5 font-mono text-sm"
            />
            {isValidCheckAddr && isTrusted !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{
                    background: isTrusted ? "rgba(52,211,153,0.15)" : "rgba(248,113,113,0.15)",
                    color: isTrusted ? "#34d399" : "#f87171",
                  }}
                >
                  {isTrusted ? "TRUSTED" : "NOT TRUSTED"}
                </span>
                <span className="font-mono text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
                  {fmtAddr(checkAddr, 6, 4)}
                </span>
              </div>
            )}
          </div>

          {/* Set resolver trust */}
          <div>
            <label className="mb-2 block text-xs font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
              SET RESOLVER TRUST
            </label>
            <input
              type="text"
              placeholder="0x... resolver address"
              value={resolverAddr}
              onChange={(e) => setResolverAddr(e.target.value)}
              className="input-field mb-3 w-full rounded-xl px-4 py-2.5 font-mono text-sm"
            />
            <div className="mb-4 flex gap-3">
              <button
                onClick={() => setResolverTrusted(true)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  resolverTrusted
                    ? "border-[rgba(52,211,153,0.4)] bg-[rgba(52,211,153,0.15)] text-[#34d399]"
                    : "border-[rgba(148,163,184,0.15)] bg-transparent text-[rgba(148,163,184,0.6)]"
                }`}
                style={{ borderWidth: 1, borderStyle: "solid" }}
              >
                Trust
              </button>
              <button
                onClick={() => setResolverTrusted(false)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                  !resolverTrusted
                    ? "border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.15)] text-[#f87171]"
                    : "border-[rgba(148,163,184,0.15)] bg-transparent text-[rgba(148,163,184,0.6)]"
                }`}
                style={{ borderWidth: 1, borderStyle: "solid" }}
              >
                Untrust
              </button>
            </div>
            <button
              disabled={
                !resolverAddr ||
                !/^0x[a-fA-F0-9]{40}$/.test(resolverAddr) ||
                resolverTx.isPending ||
                resolverMined.isLoading
              }
              onClick={() =>
                resolverTx.writeContract({
                  address: CONTRACT_ADDRESS,
                  abi: predictionMarketAbi,
                  functionName: "setTrustedResolver",
                  args: [resolverAddr as `0x${string}`, resolverTrusted],
                })
              }
              className="btn-primary w-full rounded-xl py-2.5 text-sm font-semibold"
            >
              {resolverTx.isPending || resolverMined.isLoading
                ? "Confirming..."
                : `Set as ${resolverTrusted ? "Trusted" : "Untrusted"}`}
            </button>
            {resolverTx.error && (
              <p className="mt-2 break-words text-xs text-red-400">
                {resolverTx.error.message}
              </p>
            )}
          </div>
        </div>

        {/* Transfer Ownership */}
        <div className="glass-card p-6">
          <h3 className="mb-4 text-base font-semibold" style={{ color: "#e2e8f0" }}>
            Transfer Ownership
          </h3>
          <p className="mb-4 text-xs" style={{ color: "rgba(148,163,184,0.6)" }}>
            Transfer the owner role to a new address. This action is irreversible — the new owner will have full admin control.
          </p>

          <div
            className="mb-4 rounded-xl px-4 py-3"
            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: "#f87171" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              WARNING: Irreversible action
            </div>
            <p className="mt-1 text-xs" style={{ color: "rgba(248,113,113,0.7)" }}>
              Once transferred, you will lose all admin privileges. Make sure the new address is correct.
            </p>
          </div>

          <label className="mb-2 block text-xs font-medium tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
            NEW OWNER ADDRESS
          </label>
          <input
            type="text"
            placeholder="0x..."
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="input-field mb-4 w-full rounded-xl px-4 py-2.5 font-mono text-sm"
          />
          <button
            disabled={
              !newOwner ||
              !/^0x[a-fA-F0-9]{40}$/.test(newOwner) ||
              newOwner.toLowerCase() === address?.toLowerCase() ||
              transferTx.isPending ||
              transferMined.isLoading
            }
            onClick={() =>
              transferTx.writeContract({
                address: CONTRACT_ADDRESS,
                abi: predictionMarketAbi,
                functionName: "transferOwnership",
                args: [newOwner as `0x${string}`],
              })
            }
            className="w-full rounded-xl py-2.5 text-sm font-semibold"
            style={{
              background: "linear-gradient(135deg,#dc2626,#f87171)",
              color: "white",
              opacity:
                !newOwner || !/^0x[a-fA-F0-9]{40}$/.test(newOwner) || transferTx.isPending
                  ? 0.5
                  : 1,
            }}
          >
            {transferTx.isPending || transferMined.isLoading
              ? "Confirming..."
              : "Transfer Ownership"}
          </button>
          {transferTx.error && (
            <p className="mt-2 break-words text-xs text-red-400">
              {transferTx.error.message}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.4)" }}>
        {label}
      </div>
      <div
        className={`mt-1 text-sm font-medium ${mono ? "font-mono" : ""}`}
        style={{ color: "#e2e8f0" }}
      >
        {value}
      </div>
    </div>
  );
}
