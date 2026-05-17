"use client";

import { useEffect, useRef } from "react";

/** Drifting particle background for the hero. Pure DOM, no JS lib needed. */
export function ParticlesBg() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.innerHTML = "";
    const N = 18;
    for (let i = 0; i < N; i++) {
      const p = document.createElement("div");
      p.className = "particle";
      const size = Math.random() * 3 + 1;
      const duration = Math.random() * 15 + 10;
      const delay = Math.random() * 10;
      const startX = Math.random() * 100;
      const startY = Math.random() * 100;
      const dx = (Math.random() - 0.5) * 200;
      const dy = (Math.random() - 0.5) * 200;
      p.style.cssText = `
        width:${size}px;height:${size}px;
        left:${startX}%;top:${startY}%;
        background:${Math.random() > 0.5 ? "rgba(99,102,241,0.6)" : "rgba(139,92,246,0.5)"};
        --dx:${dx}px;--dy:${dy}px;
        animation-duration:${duration}s;
        animation-delay:${delay}s;
      `;
      root.appendChild(p);
    }
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg className="absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <line x1="0" y1="25%" x2="100%" y2="25%" className="hero-grid-line" />
        <line x1="0" y1="50%" x2="100%" y2="50%" className="hero-grid-line" />
        <line x1="0" y1="75%" x2="100%" y2="75%" className="hero-grid-line" />
        <line x1="25%" y1="0" x2="25%" y2="100%" className="hero-grid-line" />
        <line x1="50%" y1="0" x2="50%" y2="100%" className="hero-grid-line" />
        <line x1="75%" y1="0" x2="75%" y2="100%" className="hero-grid-line" />
      </svg>
      <div
        className="glow-orb"
        style={{ width: 400, height: 400, background: "rgba(99,102,241,0.08)", top: "10%", left: "20%" }}
      />
      <div
        className="glow-orb"
        style={{
          width: 300,
          height: 300,
          background: "rgba(139,92,246,0.06)",
          top: "40%",
          right: "15%",
          animationDelay: "2s",
        }}
      />
      <div
        className="glow-orb"
        style={{
          width: 200,
          height: 200,
          background: "rgba(99,102,241,0.05)",
          bottom: "15%",
          left: "40%",
          animationDelay: "1s",
        }}
      />
      <div ref={ref} />
    </div>
  );
}
