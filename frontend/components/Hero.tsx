"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Hero() {
  return (
    <header className="flex flex-col gap-8 pt-12 pb-10 md:pt-20 md:pb-16">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-accent to-accent2" />
          <span className="text-lg font-semibold tracking-tight">mindset</span>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" accountStatus="address" />
      </div>

      <div className="max-w-2xl">
        <span className="badge bg-accent/15 text-accent border border-accent/30 mb-4">
          Non-custodial · Base Sepolia
        </span>
        <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05]">
          Put your money where
          <br />
          your <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">mindset</span> is.
        </h1>
        <p className="mt-5 text-white/60 text-base md:text-lg max-w-xl leading-relaxed">
          Stake ETH on a habit. Check in daily. Hit your target — get it back, every wei.
          Skip your goal — your stake goes to charity. The contract is the only custodian.
        </p>
      </div>
    </header>
  );
}
