"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ConnectButton } from "./ConnectButton";
import { FaucetButton } from "./FaucetButton";
import { classNames } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/create", label: "Create" },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-40"
      style={{
        background: "rgba(5,5,15,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(99,102,241,0.08)",
      }}
    >
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              style={{
                width: 32,
                height: 32,
                background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
                borderRadius: 8,
              }}
              className="flex items-center justify-center"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="logo-gradient text-lg font-bold tracking-wider">MINDSET</span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={classNames(
                  "nav-link text-sm font-medium tracking-wide",
                  isActive(n.href) && "active"
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <FaucetButton />
            </div>
            <div className="hidden sm:block">
              <ConnectButton />
            </div>
            {/* Mobile: show connect button always */}
            <div className="block sm:hidden">
              <ConnectButton compact />
            </div>
            <button
              className="rounded-lg p-2 md:hidden"
              style={{ color: "#94a3b8" }}
              aria-label="Toggle menu"
              onClick={() => setOpen((v) => !v)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? (
                  <>
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </>
                ) : (
                  <>
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div
            className="pb-4 md:hidden"
            style={{ borderTop: "1px solid rgba(99,102,241,0.1)" }}
          >
            <div className="flex flex-col gap-1 pt-2">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className={classNames(
                    "nav-link rounded-lg px-3 py-2 text-sm font-medium",
                    isActive(n.href) && "active"
                  )}
                >
                  {n.label}
                </Link>
              ))}
              {/* Faucet prominent on mobile */}
              <div className="mt-3 px-3">
                <FaucetButton compact />
              </div>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
