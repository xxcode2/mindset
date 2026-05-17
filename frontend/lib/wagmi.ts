"use client";

import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

/**
 * Single wagmi config that works in both Farcaster Mini App context and
 * a standalone web browser. The Farcaster connector auto-detects whether
 * we are inside a Farcaster client (via the SDK postMessage handshake)
 * and silently no-ops otherwise, so listing it first is safe.
 */
export const wagmiConfig = createConfig({
  chains: [baseSepolia, base],
  connectors: [
    farcasterMiniApp(),
    injected(),
    coinbaseWallet({ appName: "Mindset", preference: "all" }),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId, showQrModal: true })]
      : []),
  ],
  transports: {
    [baseSepolia.id]: http(),
    [base.id]: http(),
  },
  ssr: true,
});
