import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "MINDSET — Prediction Markets on Farcaster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
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
        {/* Glow orbs */}
        <div
          style={{
            position: "absolute",
            top: "-100px",
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
            bottom: "-50px",
            right: "150px",
            width: "400px",
            height: "400px",
            borderRadius: "50%",
            background: "rgba(139, 92, 246, 0.08)",
            filter: "blur(80px)",
          }}
        />

        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
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
              fontSize: "36px",
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

        {/* Title */}
        <h1
          style={{
            fontSize: "64px",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            margin: "0 0 24px",
            background: "linear-gradient(135deg, #f1f5f9 0%, #c4b5fd 40%, #818cf8 70%, #6366f1 100%)",
            backgroundClip: "text",
            color: "transparent",
            maxWidth: "900px",
          }}
        >
          Bet on what you believe.
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontSize: "24px",
            color: "rgba(148, 163, 184, 0.8)",
            margin: 0,
            textAlign: "center",
          }}
        >
          Non-custodial prediction markets on Base · Farcaster Mini App
        </p>

        {/* Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginTop: "40px",
            padding: "8px 20px",
            borderRadius: "100px",
            background: "rgba(99, 102, 241, 0.1)",
            border: "1px solid rgba(99, 102, 241, 0.25)",
          }}
        >
          <span style={{ fontSize: "14px", color: "#a5b4fc", fontWeight: 600 }}>
            YES/NO · Parimutuel · Chainlink Oracle · 1% Fee
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
