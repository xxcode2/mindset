"use client";

import { useState } from "react";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { CreateMarket } from "@/components/CreateMarket";
import { MarketList } from "@/components/MarketList";
import { CONTRACT_ADDRESS } from "@/lib/contract";

const ZERO = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <main className="mx-auto max-w-5xl px-4 md:px-6 pb-24">
      <Hero />

      {CONTRACT_ADDRESS.toLowerCase() === ZERO && (
        <div className="card border-amber-500/40 bg-amber-500/10 text-amber-200 mb-6">
          <p className="font-medium mb-1">Contract not configured</p>
          <p className="text-sm text-amber-200/80">
            Set <code className="text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in
            <code className="text-xs"> frontend/.env.local</code> after deploying. See README.
          </p>
        </div>
      )}

      <HowItWorks />

      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1.3fr]">
        <CreateMarket onCreated={refresh} />
        <div>
          <h2 className="text-lg font-semibold mb-3">Markets</h2>
          <MarketList refreshKey={refreshKey} />
        </div>
      </div>

      <footer className="mt-20 text-center text-xs text-white/40">
        <p>Non-custodial · 1% fee on losing pool · Open source · Testnet only.</p>
      </footer>
    </main>
  );
}
