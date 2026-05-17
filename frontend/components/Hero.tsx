"use client";

import { ConnectBar } from "./ConnectBar";

export function Hero() {
  return (
    <header className="flex flex-col gap-7 pt-10 pb-8 md:pt-16 md:pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent2" />
          <span className="text-lg font-semibold tracking-tight">mindset</span>
        </div>
        <ConnectBar />
      </div>
      <div className="max-w-2xl">
        <span className="badge bg-accent/15 text-accent border border-accent/30 mb-4">
          Non-custodial · Base · Farcaster
        </span>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Bet on what you{" "}
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            believe
          </span>
          .
        </h1>
        <p className="mt-4 text-white/60 text-base md:text-lg max-w-xl leading-relaxed">
          Parimutuel prediction markets. Create a question, take a side, win a slice of the
          pool. The smart contract is the only custodian — no admin, no upgrades.
        </p>
      </div>
    </header>
  );
}
