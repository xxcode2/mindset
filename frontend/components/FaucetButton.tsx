"use client";

import { useEffect } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { TOKEN_ADDRESS, TOKEN_SYMBOL, erc20Abi } from "@/lib/contract";
import { fmtToken, classNames } from "@/lib/utils";
import { pushToast } from "@/lib/toast";

export function FaucetButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected } = useAccount();

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const faucetTx = useWriteContract();
  const faucetMined = useWaitForTransactionReceipt({ hash: faucetTx.data });

  useEffect(() => {
    if (faucetMined.isSuccess) {
      pushToast(`10,000 test ${TOKEN_SYMBOL} minted`, "success");
      refetchBalance();
      faucetTx.reset();
    }
  }, [faucetMined.isSuccess]); // eslint-disable-line

  useEffect(() => {
    if (faucetTx.error) {
      pushToast(faucetTx.error.message ?? "Faucet failed", "error");
    }
  }, [faucetTx.error]);

  const click = () => {
    if (!isConnected) {
      pushToast("Connect your wallet first", "error");
      return;
    }
    faucetTx.writeContract({
      address: TOKEN_ADDRESS,
      abi: erc20Abi,
      functionName: "faucet",
      args: [],
    });
  };

  const busy = faucetTx.isPending || faucetMined.isLoading;

  return (
    <button
      onClick={click}
      disabled={busy}
      title={`Mint 10,000 test ${TOKEN_SYMBOL}`}
      className={classNames(
        "inline-flex items-center gap-2 rounded-lg font-medium transition-opacity",
        compact ? "w-full justify-center px-3 py-2 text-sm" : "px-3 py-1.5 text-xs",
        busy && "opacity-60"
      )}
      style={{
        background: "rgba(99,102,241,0.1)",
        color: "#a5b4fc",
        border: "1px solid rgba(99,102,241,0.2)",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v6" />
        <path d="M5 8h14l-1.5 11a2 2 0 0 1-2 1.8H8.5a2 2 0 0 1-2-1.8L5 8Z" />
        <path d="M9 5l3-3 3 3" />
      </svg>
      <span>{busy ? "Minting…" : `Faucet ${TOKEN_SYMBOL}`}</span>
      {!compact && isConnected && balance !== undefined && (
        <span
          className="hidden font-mono text-[10px] lg:inline"
          style={{ color: "rgba(165,180,252,0.6)" }}
        >
          · {fmtToken(balance as bigint)}
        </span>
      )}
    </button>
  );
}
