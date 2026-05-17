"use client";

import { http, createConfig } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";
import { CHAIN_ID } from "./contract";

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";
const targetChain = CHAIN_ID === 8453 ? base : baseSepolia;
const otherChain = CHAIN_ID === 8453 ? baseSepolia : base;

/**
 * Single wagmi config that works in both Farcaster Mini App context and a
 * standalone web browser. The Farcaster connector auto-detects whether we
 * are inside a Farcaster client and silently no-ops outside, so listing it
 * first is safe.
 */
export const wagmiConfig = createConfig({
  chains: [targetChain, otherChain],
  connectors: [
    farcasterMiniApp(),
    injected({ shimDisconnect: true }),
    coinbaseWallet({ appName: "Mindset", preference: "all" }),
    ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
  ],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
  ssr: true,
});
