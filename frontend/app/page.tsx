"use client";

import Link from "next/link";
import { ParticlesBg } from "@/components/ParticlesBg";
import { useAllMarkets } from "@/lib/hooks";
import { fmtCompactUsd } from "@/lib/utils";

export default function Home() {
  const { markets, isLoading } = useAllMarkets();

  // Aggregate live stats from on-chain data.
  const totalVolume = markets.reduce((acc, { market }) => acc + market.yesPool + market.noPool, 0n);
  const marketsCount = markets.length;
  const totalBettors = markets.reduce((acc, { market }) => acc + market.yesBettors + market.noBettors, 0);

  return (
    <>
      <section className="relative overflow-hidden" style={{ minHeight: "calc(100vh - 64px)" }}>
        <ParticlesBg />
        <div
          className="relative z-10 mx-auto flex max-w-7xl flex-col items-center justify-center px-4 text-center sm:px-6 lg:px-8"
          style={{ minHeight: "calc(100vh - 64px)", paddingTop: 80, paddingBottom: 80 }}
        >
          <div className="info-pill animate-fade-up delay-1 mb-8 flex items-center gap-2 rounded-full px-4 py-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            <span className="text-xs font-medium tracking-wider" style={{ color: "#a5b4fc" }}>
              BUILT ON BASE · HOSTED ON FARCASTER
            </span>
          </div>

          <h1 className="hero-title-gradient animate-fade-up delay-2 mb-6 text-5xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl lg:text-8xl">
            MINDSET
          </h1>

          <p
            className="animate-fade-up delay-3 mb-4 text-lg font-medium sm:text-xl md:text-2xl"
            style={{ color: "#c4b5fd", maxWidth: 600 }}
          >
            Prediction Markets on Farcaster
          </p>

          <p
            className="animate-fade-up delay-4 mb-10 text-sm leading-relaxed sm:text-base"
            style={{ color: "rgba(148,163,184,0.8)", maxWidth: 520 }}
          >
            Place YES/NO predictions into a shared parimutuel pool. Winners split the entire pool —
            losing stakes top up the prize. Non-custodial; the contract is the only custodian.
          </p>

          <div className="animate-fade-up delay-5 flex flex-col gap-4 sm:flex-row">
            <Link href="/markets" className="btn-primary rounded-xl px-8 py-3.5 text-base">
              Explore Markets
            </Link>
            <Link href="/create" className="btn-secondary rounded-xl px-8 py-3.5 text-base">
              Create Market
            </Link>
          </div>

          <div className="animate-fade-up delay-6 mt-16 grid grid-cols-3 gap-8 sm:gap-16">
            <Stat value={isLoading ? "—" : fmtCompactUsd(totalVolume)} label="TOTAL POOL" />
            <Stat value={isLoading ? "—" : marketsCount.toLocaleString()} label="MARKETS" />
            <Stat value={isLoading ? "—" : totalBettors.toLocaleString()} label="POSITIONS" />
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold sm:text-3xl" style={{ color: "#e2e8f0" }}>
        {value}
      </div>
      <div className="mt-1 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
        {label}
      </div>
    </div>
  );
}
