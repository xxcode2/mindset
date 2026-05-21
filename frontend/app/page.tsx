"use client";

import Link from "next/link";
import { ParticlesBg } from "@/components/ParticlesBg";
import { useAllMarkets } from "@/lib/hooks";
import { fmtCompactUsd } from "@/lib/utils";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Create or pick a market",
    description: "Spin up a YES/NO question — crypto prices, sports, politics, anything. Or browse existing markets.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    ),
  },
  {
    step: "02",
    title: "Take a side with USDC",
    description: "Bet YES or NO. Your stake goes into a shared pool. Odds shift in real-time with every new bet.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    step: "03",
    title: "Oracle or resolver settles",
    description: "Price markets auto-resolve via Chainlink feeds — no human needed. Other categories use a trusted resolver.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
  {
    step: "04",
    title: "Winners split the pool",
    description: "Your payout = (your bet ÷ winning side) × total pool. Only a 5% fee on the losing side. Full stake back + profit.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export default function Home() {
  const { markets, isLoading } = useAllMarkets(100);

  // Aggregate live stats from on-chain data.
  const totalVolume = markets.reduce((acc, { market }) => acc + market.yesPool + market.noPool, 0n);
  const marketsCount = markets.length;
  const totalBettors = markets.reduce((acc, { market }) => acc + market.yesBettors + market.noBettors, 0);

  return (
    <>
      {/* ──── HERO ──── */}
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
            <Stat value={isLoading ? undefined : fmtCompactUsd(totalVolume)} label="TOTAL POOL" />
            <Stat value={isLoading ? undefined : marketsCount.toLocaleString()} label="MARKETS" />
            <Stat value={isLoading ? undefined : totalBettors.toLocaleString()} label="POSITIONS" />
          </div>
        </div>
      </section>

      {/* ──── HOW IT WORKS ──── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold sm:text-4xl" style={{ color: "#f1f5f9" }}>
            How it works
          </h2>
          <p className="mx-auto max-w-lg text-sm leading-relaxed sm:text-base" style={{ color: "rgba(148,163,184,0.7)" }}>
            Four steps from question to payout. No intermediaries, no custody risk, no trust assumptions on price markets.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} className="glass-card glass-card-hover p-6">
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "rgba(99,102,241,0.12)", color: "#818cf8" }}
              >
                {item.icon}
              </div>
              <div className="mb-2 font-mono text-xs font-semibold" style={{ color: "#6366f1" }}>
                {item.step}
              </div>
              <h3 className="mb-2 text-base font-semibold" style={{ color: "#e2e8f0" }}>
                {item.title}
              </h3>
              <p className="text-xs leading-relaxed sm:text-sm" style={{ color: "rgba(148,163,184,0.6)" }}>
                {item.description}
              </p>
            </div>
          ))}
        </div>

        {/* Trust strip */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {[
            "Non-custodial",
            "Admin can't move funds",
            "Open source",
            "Chainlink oracles",
            "7-day refund safety net",
          ].map((t) => (
            <div
              key={t}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              {t}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Stat({ value, label }: { value: string | undefined; label: string }) {
  return (
    <div className="text-center">
      {value === undefined ? (
        <div className="mx-auto h-8 w-20 animate-pulse rounded-lg bg-white/10 sm:h-9 sm:w-24" />
      ) : (
        <div className="text-2xl font-bold sm:text-3xl" style={{ color: "#e2e8f0" }}>
          {value}
        </div>
      )}
      <div className="mt-1 text-xs tracking-wider" style={{ color: "rgba(148,163,184,0.5)" }}>
        {label}
      </div>
    </div>
  );
}
