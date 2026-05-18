import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESS, CHAIN_ID, predictionMarketAbi, TOKEN_DECIMALS, CATEGORIES } from "@/lib/contract";

export const runtime = "edge";
export const alt = "MINDSET Market";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CAT_COLORS: Record<string, string> = {
  Crypto: "#f59e0b",
  Sports: "#22c55e",
  Price: "#a78bfa",
  Politics: "#fb923c",
  Social: "#60a5fa",
  Custom: "#94a3b8",
};

function fmtCompactUsd(amount: bigint): string {
  const n = Number(amount) / 10 ** TOKEN_DECIMALS;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return `$${n.toFixed(0)}`;
  return `$${n.toFixed(2)}`;
}

function fmtCountdown(deadlineSec: number): string {
  const diff = deadlineSec - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Closed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function fetchMarket(id: bigint) {
  try {
    const chain = CHAIN_ID === 8453 ? base : baseSepolia;
    const client = createPublicClient({ chain, transport: http() });
    const market = await client.readContract({
      address: CONTRACT_ADDRESS,
      abi: predictionMarketAbi,
      functionName: "getMarket",
      args: [id],
    });
    return market as {
      question: string;
      yesPool: bigint;
      noPool: bigint;
      closeTime: bigint;
      outcome: number;
      category: number;
      yesBettors: number;
      noBettors: number;
    };
  } catch {
    return null;
  }
}

export default async function MarketOG({ params }: { params: { id: string } }) {
  let id: bigint | null = null;
  try {
    id = BigInt(params.id);
  } catch {
    id = null;
  }

  const market = id !== null ? await fetchMarket(id) : null;

  // Fallback: if RPC fails or invalid id, render a generic card
  if (!market) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #05050f 0%, #0a0a1a 50%, #050510 100%)",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span
            style={{
              fontSize: "44px",
              fontWeight: 800,
              letterSpacing: "4px",
              background: "linear-gradient(135deg, #e2e8f0, #c4b5fd)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            MINDSET
          </span>
          <p style={{ marginTop: 24, fontSize: 28, color: "rgba(148,163,184,0.7)" }}>
            Prediction market #{params.id}
          </p>
        </div>
      ),
      { ...size }
    );
  }

  const total = market.yesPool + market.noPool;
  const yesPct = total === 0n ? 50 : Number((market.yesPool * 10000n) / total) / 100;
  const noPct = 100 - yesPct;
  const status: "open" | "closed" | "resolved" | "invalid" =
    market.outcome === 1 || market.outcome === 2
      ? "resolved"
      : market.outcome === 3
      ? "invalid"
      : Date.now() / 1000 < Number(market.closeTime)
      ? "open"
      : "closed";
  const statusLabel =
    status === "resolved" && market.outcome === 1
      ? "YES WON"
      : status === "resolved" && market.outcome === 2
      ? "NO WON"
      : status.toUpperCase();
  const statusColor =
    status === "open"
      ? "#22c55e"
      : status === "resolved"
      ? "#a78bfa"
      : status === "invalid"
      ? "#f87171"
      : "#94a3b8";
  const categoryName = CATEGORIES[market.category] ?? "Custom";
  const categoryColor = CAT_COLORS[categoryName] ?? "#94a3b8";

  // Truncate question to fit
  const question = market.question.length > 120 ? market.question.slice(0, 117) + "…" : market.question;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #05050f 0%, #0a0a1a 50%, #050510 100%)",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 70px",
        }}
      >
        {/* Glow orbs */}
        <div
          style={{
            position: "absolute",
            top: "-150px",
            left: "100px",
            width: "500px",
            height: "500px",
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.12)",
            filter: "blur(80px)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: "-100px",
            right: "150px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(139, 92, 246, 0.08)",
            filter: "blur(80px)",
          }}
        />

        {/* Header: logo + status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "28px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "11px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span
              style={{
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "3px",
                background: "linear-gradient(135deg, #e2e8f0, #c4b5fd)",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              MINDSET
            </span>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <span
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: "100px",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                background: `${categoryColor}1a`,
                color: categoryColor,
                border: `1px solid ${categoryColor}40`,
              }}
            >
              {categoryName.toUpperCase()}
            </span>
            <span
              style={{
                display: "flex",
                padding: "8px 18px",
                borderRadius: "100px",
                fontSize: "14px",
                fontWeight: 700,
                letterSpacing: "1.5px",
                background: `${statusColor}1a`,
                color: statusColor,
                border: `1px solid ${statusColor}40`,
              }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Question */}
        <h1
          style={{
            fontSize: "48px",
            fontWeight: 800,
            lineHeight: 1.2,
            margin: "0 0 32px",
            color: "#f1f5f9",
            display: "flex",
          }}
        >
          {question}
        </h1>

        {/* Pool bar */}
        <div style={{ marginBottom: "28px", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "10px",
              fontSize: "20px",
              fontWeight: 600,
            }}
          >
            <span style={{ color: "#34d399" }}>YES {yesPct.toFixed(1)}%</span>
            <span style={{ color: "#f87171" }}>NO {noPct.toFixed(1)}%</span>
          </div>
          <div
            style={{
              display: "flex",
              height: "16px",
              borderRadius: "8px",
              overflow: "hidden",
              background: "rgba(20,20,40,0.8)",
            }}
          >
            <div
              style={{
                width: `${yesPct}%`,
                height: "100%",
                background: "linear-gradient(90deg, #10b981, #34d399)",
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "auto",
          }}
        >
          <Stat label="POOL" value={fmtCompactUsd(total)} />
          <Stat
            label={status === "open" ? "TIME LEFT" : "STATUS"}
            value={status === "open" ? fmtCountdown(Number(market.closeTime)) : statusLabel}
          />
          <Stat label="BETTORS" value={(market.yesBettors + market.noBettors).toString()} />
          <Stat label="MARKET" value={`#${id?.toString()}`} />
        </div>
      </div>
    ),
    { ...size }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "20px 24px",
        borderRadius: "14px",
        background: "rgba(10,10,30,0.5)",
        border: "1px solid rgba(99,102,241,0.18)",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          color: "rgba(148,163,184,0.55)",
          letterSpacing: "2px",
          marginBottom: "8px",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: "26px", fontWeight: 700, color: "#e2e8f0" }}>{value}</span>
    </div>
  );
}
