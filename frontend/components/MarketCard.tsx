"use client";

import Link from "next/link";
import type { Market } from "@/lib/contract";
import { CATEGORIES, statusFromMarket } from "@/lib/contract";
import { fmtCompactUsd, fmtCountdown } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  open: "badge-open",
  closed: "badge-closed",
  resolved: "badge-resolved",
  invalid: "badge-resolved",
};

const CAT_STYLE: Record<number, { bg: string; text: string; border: string }> = {
  0: { bg: "rgba(148,163,184,0.08)", text: "#94a3b8", border: "rgba(148,163,184,0.2)" }, // Custom
  1: { bg: "rgba(99,102,241,0.1)", text: "#818cf8", border: "rgba(99,102,241,0.25)" },   // Price
  2: { bg: "rgba(251,191,36,0.1)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" },   // Sports
  3: { bg: "rgba(244,114,182,0.1)", text: "#f472b6", border: "rgba(244,114,182,0.25)" }, // Politics
  4: { bg: "rgba(52,211,153,0.1)", text: "#34d399", border: "rgba(52,211,153,0.25)" },   // Social
  5: { bg: "rgba(251,146,60,0.1)", text: "#fb923c", border: "rgba(251,146,60,0.25)" },   // Crypto
};

const CAT_ICON: Record<number, string> = {
  0: "⚙️",
  1: "📈",
  2: "⚽",
  3: "🏛️",
  4: "💬",
  5: "🪙",
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

  const catIndex = market.category ?? 0;
  const catName = CATEGORIES[catIndex] ?? "Custom";
  const catStyle = CAT_STYLE[catIndex] ?? CAT_STYLE[0];

  return (
    <Link
      href={`/markets/${id.toString()}`}
      className="glass-card glass-card-hover block p-6 cursor-pointer"
    >
      <div className="mb-3 flex items-center gap-2">
        {/* Category badge */}
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: catStyle.bg, color: catStyle.text, border: `1px solid ${catStyle.border}` }}
        >
          <span>{CAT_ICON[catIndex]}</span>
          {catName}
        </span>
        {/* Status badge */}
        <span
          className={`${STATUS_BADGE[status]} ml-auto flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize`}
        >
          {label}
        </span>
      </div>

      <h3 className="mb-3 text-sm font-semibold leading-snug" style={{ color: "#e2e8f0" }}>
        {market.question}
      </h3>

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
