"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { fmtAddr } from "@/lib/utils";

export function ConnectBar() {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="badge bg-white/10 border border-white/10 text-white/80">
          {fmtAddr(address)}
          {connector ? <span className="ml-2 text-white/40">· {connector.name}</span> : null}
        </span>
        <button onClick={() => disconnect()} className="btn-secondary !py-1.5 !px-3 !text-xs">
          Disconnect
        </button>
      </div>
    );
  }

  // Prefer the Farcaster connector when it is the only relevant one (inside a mini app).
  // Fall back to a chooser otherwise.
  const farcasterConnector = connectors.find((c) => c.id === "farcasterMiniApp");

  return (
    <div className="flex items-center gap-2">
      {farcasterConnector && (
        <button
          onClick={() => connect({ connector: farcasterConnector })}
          disabled={isPending}
          className="btn-primary !py-1.5 !px-3 !text-xs"
        >
          Connect Farcaster
        </button>
      )}
      {connectors
        .filter((c) => c.id !== "farcasterMiniApp")
        .slice(0, 3)
        .map((c) => (
          <button
            key={c.uid}
            onClick={() => connect({ connector: c })}
            disabled={isPending}
            className="btn-secondary !py-1.5 !px-3 !text-xs"
          >
            {c.name}
          </button>
        ))}
    </div>
  );
}
