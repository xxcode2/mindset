"use client";

import { CHAIN_ID } from "@/lib/contract";

export function Footer() {
  const network = CHAIN_ID === 8453 ? "Base Mainnet" : "Base Sepolia";
  return (
    <footer
      className="mt-16"
      style={{ borderTop: "1px solid rgba(99,102,241,0.08)" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8 grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <div
                style={{
                  width: 24,
                  height: 24,
                  background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                  borderRadius: 6,
                }}
                className="flex items-center justify-center"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2.5" />
                </svg>
              </div>
              <span className="logo-gradient text-sm font-bold tracking-wider">MINDSET</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(148,163,184,0.4)" }}>
              Non-custodial parimutuel prediction markets built on Base. Hosted on Farcaster and the web.
            </p>
          </div>
          <FooterCol
            title="PROTOCOL"
            links={[
              { label: "About", href: "https://github.com/xxcode2/mindset#readme" },
              { label: "Documentation", href: "https://github.com/xxcode2/mindset#contract-surface" },
              { label: "Contracts", href: CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org" },
            ]}
          />
          <FooterCol
            title="RESOURCES"
            links={[
              { label: "BaseScan", href: CHAIN_ID === 8453 ? "https://basescan.org" : "https://sepolia.basescan.org" },
              { label: "Faucet", href: "https://www.alchemy.com/faucets/base-sepolia" },
              { label: "Bug Bounty", href: "https://github.com/xxcode2/mindset/issues" },
            ]}
          />
          <FooterCol
            title="COMMUNITY"
            links={[
              { label: "Farcaster", href: "https://warpcast.com" },
              { label: "GitHub", href: "https://github.com/xxcode2/mindset" },
              { label: "X / Twitter", href: "https://x.com" },
            ]}
          />
        </div>
        <div
          className="flex flex-col items-center justify-between gap-4 pt-8 sm:flex-row"
          style={{ borderTop: "1px solid rgba(99,102,241,0.06)" }}
        >
          <p className="text-xs" style={{ color: "rgba(148,163,184,0.3)" }}>
            © 2026 Mindset Protocol · Use at your own risk · Not audited.
          </p>
          <div className="info-pill flex items-center gap-2 rounded-full px-3 py-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2.5">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <span className="text-xs" style={{ color: "#a5b4fc" }}>
              {network}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h4
        className="mb-3 text-xs font-semibold tracking-wider"
        style={{ color: "rgba(148,163,184,0.5)" }}
      >
        {title}
      </h4>
      <div className="flex flex-col gap-2">
        {links.map((l) => (
          <a
            key={l.label}
            href={l.href}
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel="noreferrer"
            className="text-xs transition hover:text-text2"
            style={{ color: "rgba(148,163,184,0.55)" }}
          >
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}
