"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { CHAIN_ID } from "@/lib/contract";

const CHAIN_NAMES: Record<number, string> = {
  1: "Ethereum Mainnet",
  8453: "Base",
  84532: "Base Sepolia",
  10: "Optimism",
  42161: "Arbitrum",
};

const TARGET_NAME = CHAIN_NAMES[CHAIN_ID] ?? `Chain ${CHAIN_ID}`;

/**
 * Displays a warning banner when the user's wallet is connected to the wrong network.
 * Offers a one-click switch to the correct chain.
 */
export function NetworkWarning() {
  const { isConnected, chain } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  // Don't show anything if not connected or already on correct chain
  if (!isConnected || !chain || chain.id === CHAIN_ID) return null;

  const currentName = CHAIN_NAMES[chain.id] ?? `Chain ${chain.id}`;

  return (
    <div
      className="fixed inset-x-0 top-16 z-50 flex items-center justify-center gap-3 px-4 py-3"
      style={{
        background: "rgba(251,191,36,0.12)",
        borderBottom: "1px solid rgba(251,191,36,0.3)",
        backdropFilter: "blur(8px)",
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fbbf24"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <span className="text-xs font-medium sm:text-sm" style={{ color: "#fde68a" }}>
        Wrong network — you're on <strong>{currentName}</strong>, please switch to{" "}
        <strong>{TARGET_NAME}</strong>
      </span>
      <button
        onClick={() => switchChain({ chainId: CHAIN_ID })}
        disabled={isPending}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
        style={{
          background: "rgba(251,191,36,0.2)",
          border: "1px solid rgba(251,191,36,0.4)",
          color: "#fde68a",
        }}
      >
        {isPending ? "Switching…" : `Switch to ${TARGET_NAME}`}
      </button>
    </div>
  );
}
