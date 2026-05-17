"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useEffect, useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  // Tell the Farcaster client we are ready, so it can hide its splash screen.
  // Safe no-op outside Farcaster context.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@farcaster/miniapp-sdk");
        if (cancelled) return;
        await mod.sdk.actions.ready();
      } catch {
        /* not in a mini app; ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
