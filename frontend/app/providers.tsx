"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useRef, useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { sdk } from "@farcaster/miniapp-sdk";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const readyCalled = useRef(false);

  // Tell the Farcaster client we are ready, so it can hide its splash screen.
  // Must be called ASAP. The SDK gracefully no-ops outside a Farcaster webview.
  useEffect(() => {
    if (readyCalled.current) return;
    readyCalled.current = true;
    try {
      sdk.actions.ready();
    } catch {
      // Not inside a Farcaster mini app — ignore.
    }
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
