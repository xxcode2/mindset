"use client";

import { useState } from "react";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { CreateHabit } from "@/components/CreateHabit";
import { HabitList } from "@/components/HabitList";
import { CONTRACT_ADDRESS } from "@/lib/contract";

const ZERO = "0x0000000000000000000000000000000000000000";

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <main className="mx-auto max-w-5xl px-4 md:px-6 pb-24">
      <Hero />

      {CONTRACT_ADDRESS.toLowerCase() === ZERO && (
        <div className="card border-amber-500/40 bg-amber-500/10 text-amber-200 mb-8">
          <p className="font-medium mb-1">Contract not configured</p>
          <p className="text-sm text-amber-200/80">
            Set <code className="text-xs">NEXT_PUBLIC_CONTRACT_ADDRESS</code> in
            <code className="text-xs"> frontend/.env.local</code> after deploying. See README.
          </p>
        </div>
      )}

      <HowItWorks />

      <div className="mt-10 grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <CreateHabit onCreated={refresh} />
        <div>
          <h2 className="text-lg font-semibold mb-3">Your habits</h2>
          <HabitList refreshKey={refreshKey} onAction={refresh} />
        </div>
      </div>

      <footer className="mt-20 text-center text-xs text-white/40">
        <p>Non-custodial · Source on GitHub · Use at your own risk · Testnet only.</p>
      </footer>
    </main>
  );
}
