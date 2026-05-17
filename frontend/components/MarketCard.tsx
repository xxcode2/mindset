"use client";

import Link from "next/link";
import type { Market } from "@/lib/contract";
import { OUTCOME_LABEL, statusFromMarket } from "@/lib/contract";
import { fmtCompactUsd, fmtCountdown } from "@/lib/utils";

const BADGE: Record<string, string> = {
  open: "badge-open",
  closed: "badge-closed",
  resolved: "badge-resolved",
  invalid: "badge-resolved",
};

export function MarketCard({ id, market }: { id: bigint; market: Market }) {
  const status = statusFromMarket(market);
  const total = market.yesPool + market.noPool;
  const yesPct =
    total === 0n ? 50 : Number((market.yesPool * 10000n) / total) / 100;
  const noPct = 100 - yesPct;
  const participants = market.yesBettors + market.noBettors;
  const closeSec = Number(market.closeTime);

  const label =
    status === "resolved" && market.outcome === 1
      ? "YES won"
      : status === "resolved" && market.outcome === 2
      ? "NO won"
      : status === "invalid"
      ? "invalid"
      : status;

  return (
    <Link
      href={`/markets/${id.toString()}`}
      className="glass-card glass-card-hover block p-6 cursor-pointer"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-snug" style={{ color: "#e2e8f0" }}>
          {market.question}
        </h3>
        <span
          className={`${BADGE[status]} flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize`}
        >
          {label}
        </span>
      </div>
      <div
        className="mb-4 flex items-center gap-2 text-xs font-mono"
        style={{ color: "rgba(148,163,184,0.5)" }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
        {status === "open" ? fmtCountdown(closeSec) : status === "closed" ? "Awaiting resolution" : "Closed"}
      </div>
      <div className="mb-4">
        <div className="mb-1.5 flex justify-between text-xs font-medium">
          <span style={{ color: "#34d399" }}>YES {yesPct.toFixed(1)}%</span>
          <span style={{ color: "#f87171" }}>NO {noPct.toFixed(1)}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full"
          style={{ background: "rgba(20,20,40,0.8)" }}
        >
          <div
            className="pool-bar-yes h-full rounded-full transition-all duration-700"
            style={{ width: `${yesPct}%` }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>
            Pool Value
          </div>
          <div className="text-base font-bold" style={{ color: "#e2e8f0" }}>
            {fmtCompactUsd(total)}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(148,163,184,0.4)" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>
            {participants} bets
          </span>
        </div>
      </div>
    </Link>
  );
}
