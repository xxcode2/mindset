"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { fmtAddr } from "@/lib/utils";
import { pushToast } from "@/lib/toast";
import { classNames } from "@/lib/utils";

export function ConnectButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, connector } = useAccount();
  const { connectors, connect, isPending } = useConnect({
    mutation: {
      onSuccess: () => pushToast("Wallet connected", "success"),
      onError: (e) => pushToast(e.message ?? "Connection failed", "error"),
    },
  });
  const { disconnect } = useDisconnect();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  if (isConnected && address) {
    return (
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className={classNames(
            "rounded-xl text-xs font-semibold font-mono transition",
            compact ? "px-3 py-2" : "px-4 py-2"
          )}
          style={{
            background: "rgba(99,102,241,0.15)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#c4b5fd",
          }}
        >
          {fmtAddr(address)}
        </button>
        {open && (
          <div
            className="glass-card absolute right-0 mt-2 w-56 p-3 text-sm"
            style={{ zIndex: 60 }}
          >
            <div className="mb-2 px-1 text-xs" style={{ color: "rgba(148,163,184,0.5)" }}>
              Connected via {connector?.name}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(address)}
              className="w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white/5"
              style={{ color: "#cbd5e1" }}
            >
              Copy address
            </button>
            <button
              onClick={() => {
                disconnect();
                pushToast("Wallet disconnected", "info");
                setOpen(false);
              }}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-white/5"
              style={{ color: "#f87171" }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Not connected: try farcasterMiniApp first if available, else open chooser.
  const farcaster = connectors.find((c) => c.id === "farcasterMiniApp");
  const others = connectors.filter((c) => c.id !== "farcasterMiniApp");

  return (
    <div ref={ref} className="relative">
      <button
        disabled={isPending}
        onClick={() => {
          if (farcaster && typeof window !== "undefined" && (window as any).self !== (window as any).top) {
            // Inside an iframe (Farcaster client) — connect Farcaster directly.
            connect({ connector: farcaster });
          } else {
            setOpen((v) => !v);
          }
        }}
        className={classNames(
          "btn-primary rounded-xl text-sm",
          compact ? "px-3 py-2" : "px-4 py-2"
        )}
      >
        {isPending ? "Connecting…" : "Connect Wallet"}
      </button>
      {open && (
        <div
          className="glass-card absolute right-0 mt-2 w-64 p-2 text-sm"
          style={{ zIndex: 60 }}
        >
          {farcaster && (
            <ConnectorRow
              label="Farcaster"
              hint="If you're inside a Farcaster client"
              onClick={() => {
                connect({ connector: farcaster });
                setOpen(false);
              }}
            />
          )}
          {others.map((c) => (
            <ConnectorRow
              key={c.uid}
              label={c.name}
              onClick={() => {
                connect({ connector: c });
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectorRow({
  label,
  hint,
  onClick,
}: {
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition hover:bg-white/5"
    >
      <span className="text-sm font-medium" style={{ color: "#e2e8f0" }}>
        {label}
      </span>
      {hint && (
        <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.5)" }}>
          {hint}
        </span>
      )}
    </button>
  );
}
